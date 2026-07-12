import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";
import { CreateChatbotSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** GET /api/chatbots/:id — full bot incl. flow, for the builder to load. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);
  const { id } = await ctx.params;
  const chatbot = await prisma.chatbot.findFirst({
    where: { id, clientId },
    select: { id: true, name: true, status: true, flow: true, updatedAt: true },
  });
  if (!chatbot) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ chatbot });
}

/** PATCH /api/chatbots/:id — full replace (name, status, flow). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const parsed = CreateChatbotSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const existing = await prisma.chatbot.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const chatbot = await prisma.chatbot.update({
      where: { id },
      data: { name: parsed.data.name, status: parsed.data.status, flow: parsed.data.flow as Prisma.InputJsonValue },
      select: { id: true, name: true, status: true },
    });
    return NextResponse.json({ chatbot });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: `A chatbot named "${parsed.data.name}" already exists.` }, { status: 409 });
    }
    throw err;
  }
}

/** DELETE /api/chatbots/:id — remove a bot. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const existing = await prisma.chatbot.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.chatbot.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
