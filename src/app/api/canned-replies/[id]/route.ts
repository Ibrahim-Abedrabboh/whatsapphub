import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";
import { CannedReplySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** PATCH /api/canned-replies/:id — update a snippet (full replace). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const parsed = CannedReplySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const existing = await prisma.cannedReply.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const reply = await prisma.cannedReply.update({
      where: { id },
      data: { title: parsed.data.title, shortcut: parsed.data.shortcut ?? null, body: parsed.data.body },
      select: { id: true, title: true, shortcut: true, body: true },
    });
    return NextResponse.json({ reply });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: `A snippet titled "${parsed.data.title}" already exists.` }, { status: 409 });
    }
    throw err;
  }
}

/** DELETE /api/canned-replies/:id — remove a snippet. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const existing = await prisma.cannedReply.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.cannedReply.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
