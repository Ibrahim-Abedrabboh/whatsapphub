import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";
import { AutomationRuleSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** GET /api/automation-rules — this client's inbound automation rules. */
export async function GET(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rules = await prisma.automationRule.findMany({
    where: { clientId: await getClientId(req) },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, enabled: true, trigger: true, action: true },
  });
  return NextResponse.json({ rules });
}

/** POST /api/automation-rules — create a rule (unique name per client). */
export async function POST(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = AutomationRuleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }
  const clientId = await getClientId(req);
  try {
    const rule = await prisma.automationRule.create({
      data: { clientId, name: parsed.data.name, enabled: parsed.data.enabled, trigger: parsed.data.trigger, action: parsed.data.action },
      select: { id: true, name: true, enabled: true, trigger: true, action: true },
    });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: `A rule named "${parsed.data.name}" already exists.` }, { status: 409 });
    }
    throw err;
  }
}
