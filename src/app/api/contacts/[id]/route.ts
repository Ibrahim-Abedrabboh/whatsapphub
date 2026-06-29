import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { UpdateContactSchema } from "@/lib/validation";
import { getClientId } from "@/lib/users";
import { buildTimeline } from "@/lib/contactTimeline";

export const runtime = "nodejs";

/** GET /api/contacts/:id — Contact 360 profile + unified cross-channel timeline. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const contact = await prisma.contact.findFirst({
    where: { id, clientId },
    include: { memberships: { include: { list: { select: { id: true, name: true } } } } },
  });
  if (!contact) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Cross-channel inbox messages (the contact may have a thread per channel).
  const convos = await prisma.conversation.findMany({
    where: { clientId, contactId: id },
    select: {
      id: true,
      messages: { orderBy: { createdAt: "asc" }, take: 200, select: { id: true, channel: true, direction: true, text: true, type: true, createdAt: true } },
      notes: { select: { id: true, body: true, createdAt: true, author: { select: { name: true, email: true } } } },
    },
  });
  const messages = convos.flatMap((c) => c.messages.map((m) => ({ ...m, direction: m.direction === "OUT" ? ("OUT" as const) : ("IN" as const) })));
  const notes = convos.flatMap((c) => c.notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt, authorName: n.author ? (n.author.name ?? n.author.email) : null })));

  // Broadcasts this contact received.
  const recipients = await prisma.broadcastRecipient.findMany({
    where: { contactId: id, broadcast: { clientId } },
    select: { broadcast: { select: { id: true, status: true, createdAt: true, template: { select: { name: true } } } } },
    take: 100,
  });
  const broadcasts = recipients.map((r) => ({ id: r.broadcast.id, templateName: r.broadcast.template.name, status: r.broadcast.status, createdAt: r.broadcast.createdAt }));

  return NextResponse.json({
    contact: {
      id: contact.id, phone: contact.phone, name: contact.name,
      attributes: contact.attributes, tags: contact.tags, optedOut: contact.optedOut,
      createdAt: contact.createdAt,
      lists: contact.memberships.map((m) => ({ id: m.list.id, name: m.list.name })),
    },
    timeline: buildTimeline({ messages, broadcasts, notes }),
  });
}

/**
 * PATCH /api/contacts/:id — edit a contact (name/phone) and/or toggle opt-out.
 * Keeps the OptOut table in sync (broadcast enqueue checks both).
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = UpdateContactSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const clientId = await getClientId(req);
  const contact = await prisma.contact.findFirst({ where: { id, clientId } });
  if (!contact) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { optedOut, name, phone, tags, attributes } = parsed.data;

  // Reject a phone change that would collide with another contact (same client).
  if (phone !== undefined && phone !== contact.phone) {
    const clash = await prisma.contact.findFirst({ where: { phone, clientId }, select: { id: true } });
    if (clash) {
      return NextResponse.json({ error: "Another contact already uses this phone number." }, { status: 409 });
    }
  }

  const data: Prisma.ContactUpdateInput = {};
  if (name !== undefined) data.name = name === "" ? null : name;
  if (phone !== undefined) data.phone = phone;
  if (optedOut !== undefined) data.optedOut = optedOut;
  if (tags !== undefined) data.tags = tags;
  if (attributes !== undefined) data.attributes = attributes;

  const updated = await prisma.contact.update({ where: { id }, data });

  // Mirror opt-out into the OptOut table. If the phone also changed, drop the
  // stale row under the old number first so both tables stay consistent.
  if (phone !== undefined && phone !== contact.phone) {
    await prisma.optOut.deleteMany({ where: { phone: contact.phone, clientId } });
  }
  if (optedOut !== undefined || (phone !== undefined && phone !== contact.phone)) {
    if (updated.optedOut) {
      const existing = await prisma.optOut.findFirst({ where: { phone: updated.phone, clientId }, select: { id: true } });
      if (!existing) await prisma.optOut.create({ data: { phone: updated.phone, clientId, source: "manual" } });
    } else {
      await prisma.optOut.deleteMany({ where: { phone: updated.phone, clientId } });
    }
  }

  return NextResponse.json({
    ok: true,
    contact: { id: updated.id, phone: updated.phone, name: updated.name, optedOut: updated.optedOut, tags: updated.tags, attributes: updated.attributes },
  });
}

/** DELETE /api/contacts/:id (scoped to the caller's client). */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await prisma.contact.deleteMany({ where: { id, clientId: await getClientId(req) } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
