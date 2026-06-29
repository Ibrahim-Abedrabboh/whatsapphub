import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/users";
import { sendReadReceipt } from "@/lib/whatsapp";
import { getChannel } from "@/lib/channels";

export const runtime = "nodejs";

/** GET /api/conversations/:id — thread + 24h-window status. Marks it read. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const convo = await prisma.conversation.findFirst({
    where: { id, clientId },
    include: { contact: { select: { name: true } } },
  });
  if (!convo) return NextResponse.json({ error: "not found" }, { status: 404 });

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    take: 300,
  });

  // Opening the thread clears the unread badge + sends a WhatsApp read receipt
  // for the latest inbound message (only on the unread→read transition, so polls
  // don't spam Meta).
  if (convo.unread > 0) {
    await prisma.conversation.update({ where: { id }, data: { unread: 0 } });
    // Read receipts are WhatsApp-specific (Meta IG/Messenger use a different ack).
    if (convo.channel === "WHATSAPP") {
      const lastIn = await prisma.message.findFirst({
        where: { conversationId: id, direction: "IN", wamid: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { wamid: true },
      });
      if (lastIn?.wamid) await sendReadReceipt(lastIn.wamid, clientId);
    }
  }

  const windowOpen = getChannel(convo.channel).isWindowOpen(convo.lastInboundAt);

  return NextResponse.json({
    conversation: {
      id: convo.id,
      phone: convo.phone,
      channel: convo.channel,
      name: convo.contact?.name ?? null,
      lastInboundAt: convo.lastInboundAt,
      windowOpen,
    },
    messages: messages.map((m) => ({
      id: m.id, direction: m.direction, type: m.type, text: m.text,
      mediaMime: m.mediaMime, mediaFilename: m.mediaFilename,
      status: m.status, error: m.error, createdAt: m.createdAt,
    })),
  });
}
