import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";
import { SegmentRulesSchema } from "@/lib/validation";
import { matchContact, type SegmentRules } from "@/lib/segments";

export const runtime = "nodejs";

const PreviewSchema = z.object({ rules: SegmentRulesSchema });

/**
 * POST /api/segments/preview — { rules } → how many contacts match right now.
 * Takes the rules in the body (not a segment id) so the rule builder can
 * preview unsaved edits; saved segments preview by posting their stored rules.
 * Opted-out contacts are excluded, mirroring the send-time audience.
 */
export async function POST(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = PreviewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const contacts = await prisma.contact.findMany({
    where: { clientId: await getClientId(req), optedOut: false },
    select: { name: true, phone: true, optedOut: true, tags: true, attributes: true },
  });

  const rules = parsed.data.rules as SegmentRules;
  const matched = contacts.filter((c) => matchContact(c, rules));

  return NextResponse.json({
    total: contacts.length,
    matched: matched.length,
    sample: matched.slice(0, 5).map((c) => ({ name: c.name, phone: c.phone })),
  });
}
