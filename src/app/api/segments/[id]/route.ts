import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";
import { SegmentSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** PATCH /api/segments/:id — update a segment (full replace). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const parsed = SegmentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const existing = await prisma.segment.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const segment = await prisma.segment.update({
      where: { id },
      data: { name: parsed.data.name, rules: parsed.data.rules },
      select: { id: true, name: true, rules: true, updatedAt: true },
    });
    return NextResponse.json({ segment });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: `A segment named "${parsed.data.name}" already exists.` }, { status: 409 });
    }
    throw err;
  }
}

/** DELETE /api/segments/:id — remove a segment (past broadcasts keep their data; their segment link nulls out). */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const existing = await prisma.segment.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.segment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
