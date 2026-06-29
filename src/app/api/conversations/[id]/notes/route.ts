import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientId, getCurrentUserId } from "@/lib/users";
import { CreateNoteSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Shape a note for JSON, flattening the author to a display name. */
function noteJson(n: {
  id: string; body: string; authorId: string | null; createdAt: Date;
  author: { name: string | null; email: string } | null;
}) {
  return {
    id: n.id,
    body: n.body,
    authorId: n.authorId,
    authorName: n.author ? (n.author.name ?? n.author.email) : null,
    createdAt: n.createdAt,
  };
}

const noteInclude = { author: { select: { name: true, email: true } } } as const;

/** GET /api/conversations/:id/notes — internal notes, oldest first. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const convo = await prisma.conversation.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!convo) return NextResponse.json({ error: "not found" }, { status: 404 });

  const notes = await prisma.internalNote.findMany({
    where: { conversationId: id, clientId },
    orderBy: { createdAt: "asc" },
    include: noteInclude,
  });
  return NextResponse.json({ notes: notes.map(noteJson) });
}

/** POST /api/conversations/:id/notes — add an internal note (agent-only). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const parsed = CreateNoteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const convo = await prisma.conversation.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!convo) return NextResponse.json({ error: "not found" }, { status: 404 });

  const note = await prisma.internalNote.create({
    data: { clientId, conversationId: id, authorId: await getCurrentUserId(req), body: parsed.data.body },
    include: noteInclude,
  });
  return NextResponse.json({ note: noteJson(note) }, { status: 201 });
}
