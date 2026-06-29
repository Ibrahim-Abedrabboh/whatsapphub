import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";
import { KnowledgeSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** PATCH /api/knowledge/:id — update a KB doc (full replace). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const parsed = KnowledgeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const existing = await prisma.knowledgeDoc.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const doc = await prisma.knowledgeDoc.update({
      where: { id },
      data: { title: parsed.data.title, content: parsed.data.content, source: parsed.data.source ?? null },
      select: { id: true, title: true, content: true, source: true },
    });
    return NextResponse.json({ doc });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: `A doc titled "${parsed.data.title}" already exists.` }, { status: 409 });
    }
    throw err;
  }
}

/** DELETE /api/knowledge/:id — remove a KB doc. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const existing = await prisma.knowledgeDoc.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.knowledgeDoc.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
