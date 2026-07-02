import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { LeadSchema } from "@/lib/validation";
import { DEFAULT_CLIENT_ID } from "@/lib/tenancy";

export const runtime = "nodejs";

const LEADS_LIST_NAME = "Website Leads";

/**
 * POST /api/leads — public lead capture from the landing page (no auth;
 * middleware allowlists this path). Rate-limited per IP; a filled honeypot
 * pretends success and stores nothing. Leads land in the DEFAULT tenant as
 * contacts in a "Website Leads" list.
 */
export async function POST(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
  const { allowed } = await rateLimit(`lead:${ip}`, 5, 600);
  if (!allowed) return NextResponse.json({ error: "too many requests" }, { status: 429 });

  const parsed = LeadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }
  const { name, phone, business, website } = parsed.data;

  // Honeypot tripped: pretend success so the bot learns nothing.
  if (website && website.length > 0) return NextResponse.json({ ok: true });

  const clientId = DEFAULT_CLIENT_ID;

  // Find-or-create the leads list (case-insensitive, like the lists API).
  const list =
    (await prisma.contactList.findFirst({
      where: { clientId, name: { equals: LEADS_LIST_NAME, mode: "insensitive" } },
    })) ?? (await prisma.contactList.create({ data: { clientId, name: LEADS_LIST_NAME } }));

  // Upsert the contact, merging lead attributes on top of any existing ones.
  const existing = await prisma.contact.findUnique({
    where: { clientId_phone: { clientId, phone } },
    select: { id: true, attributes: true },
  });
  const leadAttrs = { firstName: name, source: "landing", ...(business ? { business } : {}) };
  const contact = existing
    ? await prisma.contact.update({
        where: { id: existing.id },
        data: { name, attributes: { ...((existing.attributes ?? {}) as Record<string, string>), ...leadAttrs } },
        select: { id: true },
      })
    : await prisma.contact.create({
        data: { clientId, phone, name, attributes: leadAttrs },
        select: { id: true },
      });

  await prisma.contactListMembership.upsert({
    where: { contactId_listId: { contactId: contact.id, listId: list.id } },
    create: { contactId: contact.id, listId: list.id },
    update: {},
  });

  // Actor attribution: no audit table exists yet (V2 §2.11) — leave a server
  // log so lead creation is at least traceable until the audit log ships.
  console.log(`[leads] lead.created target=${phone} name=${JSON.stringify(name)}${business ? ` business=${JSON.stringify(business)}` : ""} (actor=landing-page)`);

  return NextResponse.json({ ok: true });
}
