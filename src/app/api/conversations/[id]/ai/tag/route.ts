import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/users";
import { isAiConfigured, tagMessage, AiNotConfiguredError } from "@/lib/ai";

export const runtime = "nodejs";

const TagSchema = z.object({ messageId: z.string().min(1) });

/** POST /api/conversations/:id/ai/tag — classify one message's intent +
 *  sentiment and persist it to Message.aiTags. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAiConfigured()) return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const parsed = TagSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "messageId required" }, { status: 400 });

  const msg = await prisma.message.findFirst({
    where: { id: parsed.data.messageId, conversationId: id, clientId },
    select: { id: true, text: true },
  });
  if (!msg) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!msg.text?.trim()) return NextResponse.json({ error: "no text to classify" }, { status: 400 });

  try {
    const tags = await tagMessage(msg.text);
    await prisma.message.update({
      where: { id: msg.id },
      data: { aiTags: { intent: tags.intent, sentiment: tags.sentiment } },
    });
    return NextResponse.json({ tags });
  } catch (e) {
    if (e instanceof AiNotConfiguredError) return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI request failed" }, { status: 502 });
  }
}
