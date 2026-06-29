import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";
import { FlowSchema } from "@/lib/validation";
import { validateFlowDefinition } from "@/lib/flows";

export const runtime = "nodejs";

/** GET /api/flows — this client's flows. */
export async function GET(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const flows = await prisma.flow.findMany({
    where: { clientId: await getClientId(req) },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, definition: true, metaId: true, status: true },
  });
  return NextResponse.json({ flows });
}

/** POST /api/flows — create a flow (unique name per client). */
export async function POST(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = FlowSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }
  const check = validateFlowDefinition(parsed.data.definition);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const clientId = await getClientId(req);
  try {
    const flow = await prisma.flow.create({
      data: { clientId, name: parsed.data.name, definition: parsed.data.definition as Prisma.InputJsonValue },
      select: { id: true, name: true, definition: true, metaId: true, status: true },
    });
    return NextResponse.json({ flow }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: `A flow named "${parsed.data.name}" already exists.` }, { status: 409 });
    }
    throw err;
  }
}
