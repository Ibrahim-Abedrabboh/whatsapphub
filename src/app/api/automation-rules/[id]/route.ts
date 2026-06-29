import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";
import { AutomationRuleSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** PATCH /api/automation-rules/:id — update a rule (full replace). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const parsed = AutomationRuleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const existing = await prisma.automationRule.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const rule = await prisma.automationRule.update({
      where: { id },
      data: { name: parsed.data.name, enabled: parsed.data.enabled, trigger: parsed.data.trigger, action: parsed.data.action },
      select: { id: true, name: true, enabled: true, trigger: true, action: true },
    });
    return NextResponse.json({ rule });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: `A rule named "${parsed.data.name}" already exists.` }, { status: 409 });
    }
    throw err;
  }
}

/** DELETE /api/automation-rules/:id — remove a rule. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const existing = await prisma.automationRule.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.automationRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
