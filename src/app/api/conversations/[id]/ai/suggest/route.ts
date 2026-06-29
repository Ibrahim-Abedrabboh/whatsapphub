import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/users";
import { isAiConfigured, suggestReplies, AiNotConfiguredError } from "@/lib/ai";
import { loadThread } from "@/lib/aiThread";

export const runtime = "nodejs";

/** POST /api/conversations/:id/ai/suggest — 3 suggested replies (agent picks one). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAiConfigured()) return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const convo = await prisma.conversation.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!convo) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const suggestions = await suggestReplies(await loadThread(id));
    return NextResponse.json({ suggestions });
  } catch (e) {
    if (e instanceof AiNotConfiguredError) return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI request failed" }, { status: 502 });
  }
}
