import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientId, getCurrentUserId } from "@/lib/users";
import { sendReadReceipt } from "@/lib/whatsapp";
import { getChannel } from "@/lib/channels";
import { UpdateConversationSchema } from "@/lib/validation";
import { closedAtFor } from "@/lib/conversationStatus";

export const runtime = "nodejs";

/** Shape an assignee relation for JSON (or null when unassigned). */
function assigneeJson(a: { id: string; name: string | null; email: string } | null) {
  return a ? { id: a.id, name: a.name, email: a.email } : null;
}

/** GET /api/conversations/:id — thread + 24h-window status. Marks it read. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const convo = await prisma.conversation.findFirst({
    where: { id, clientId },
    include: {
      contact: { select: { name: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });
  if (!convo) return NextResponse.json({ error: "not found" }, { status: 404 });

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    take: 300,
  });

  const notes = await prisma.internalNote.findMany({
    where: { conversationId: id, clientId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { name: true, email: true } } },
  });

  // Opening the thread clears the unread badge + sends a WhatsApp read receipt
  // for the latest inbound message (only on the unread→read transition, so polls
  // don't spam Meta).
  if (convo.unread > 0) {
    await prisma.conversation.update({ where: { id }, data: { unread: 0 } });
    // Read receipts are WhatsApp-specific (Meta IG/Messenger use a different ack).
    if (convo.channel === "WHATSAPP") {
      const lastIn = await prisma.message.findFirst({
        where: { conversationId: id, direction: "IN", wamid: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { wamid: true },
      });
      if (lastIn?.wamid) await sendReadReceipt(lastIn.wamid, clientId);
    }
  }

  const windowOpen = getChannel(convo.channel).isWindowOpen(convo.lastInboundAt);

  return NextResponse.json({
    conversation: {
      id: convo.id,
      phone: convo.phone,
      channel: convo.channel,
      name: convo.contact?.name ?? null,
      lastInboundAt: convo.lastInboundAt,
      windowOpen,
      status: convo.status,
      assignedToId: convo.assignedToId,
      assignee: assigneeJson(convo.assignedTo),
      firstResponseAt: convo.firstResponseAt,
      closedAt: convo.closedAt,
      aiSummary: convo.aiSummary,
    },
    messages: messages.map((m) => ({
      id: m.id, direction: m.direction, type: m.type, text: m.text,
      mediaMime: m.mediaMime, mediaFilename: m.mediaFilename,
      status: m.status, error: m.error, createdAt: m.createdAt, aiTags: m.aiTags,
    })),
    notes: notes.map((n) => ({
      id: n.id, body: n.body, authorId: n.authorId,
      authorName: n.author ? (n.author.name ?? n.author.email) : null, createdAt: n.createdAt,
    })),
  });
}

/** PATCH /api/conversations/:id — set helpdesk status and/or assignee (V2 §2.3). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const parsed = UpdateConversationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const convo = await prisma.conversation.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!convo) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data: { status?: string; closedAt?: Date | null; assignedToId?: string | null } = {};

  if (parsed.data.status !== undefined) {
    data.status = parsed.data.status;
    data.closedAt = closedAtFor(parsed.data.status, new Date());
  }

  if (parsed.data.assignedToId !== undefined) {
    let assigneeId: string | null = parsed.data.assignedToId;
    if (assigneeId === "me") {
      assigneeId = await getCurrentUserId(req);
      if (!assigneeId) return NextResponse.json({ error: "your account has no team-member record" }, { status: 400 });
    }
    if (assigneeId) {
      const member = await prisma.user.findFirst({ where: { id: assigneeId, clientId }, select: { id: true } });
      if (!member) return NextResponse.json({ error: "assignee is not in this client" }, { status: 400 });
    }
    data.assignedToId = assigneeId; // string (assign) or null (unassign)
  }

  const updated = await prisma.conversation.update({
    where: { id },
    data,
    include: { assignedTo: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({
    conversation: {
      id: updated.id,
      status: updated.status,
      assignedToId: updated.assignedToId,
      assignee: assigneeJson(updated.assignedTo),
      closedAt: updated.closedAt,
    },
  });
}
