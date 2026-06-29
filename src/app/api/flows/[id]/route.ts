import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";
import { FlowSchema } from "@/lib/validation";
import { validateFlowDefinition } from "@/lib/flows";

export const runtime = "nodejs";

/** PATCH /api/flows/:id — update a flow (full replace; resets to DRAFT). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const parsed = FlowSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }
  const check = validateFlowDefinition(parsed.data.definition);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const existing = await prisma.flow.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const flow = await prisma.flow.update({
      where: { id },
      data: { name: parsed.data.name, definition: parsed.data.definition as Prisma.InputJsonValue, status: "DRAFT", metaId: null },
      select: { id: true, name: true, definition: true, metaId: true, status: true },
    });
    return NextResponse.json({ flow });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: `A flow named "${parsed.data.name}" already exists.` }, { status: 409 });
    }
    throw err;
  }
}

/** DELETE /api/flows/:id — remove a flow. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const existing = await prisma.flow.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.flow.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
