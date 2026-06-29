import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/users";
import { isAiConfigured, faqAnswer, rankDocs, AiNotConfiguredError } from "@/lib/ai";

export const runtime = "nodejs";

/** POST /api/conversations/:id/ai/faq — draft a KB-grounded answer to the
 *  customer's latest message (suggest-not-send). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAiConfigured()) return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const convo = await prisma.conversation.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!convo) return NextResponse.json({ error: "not found" }, { status: 404 });

  const lastIn = await prisma.message.findFirst({
    where: { conversationId: id, direction: "IN", text: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { text: true },
  });
  const question = lastIn?.text?.trim();
  if (!question) return NextResponse.json({ error: "no customer message to answer" }, { status: 400 });

  const docs = await prisma.knowledgeDoc.findMany({
    where: { clientId },
    select: { id: true, title: true, content: true },
  });

  try {
    const answer = await faqAnswer(question, rankDocs(question, docs));
    return NextResponse.json({ answer });
  } catch (e) {
    if (e instanceof AiNotConfiguredError) return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI request failed" }, { status: 502 });
  }
}
