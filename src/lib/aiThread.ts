import { prisma } from "./db";
import { type ThreadMsg } from "./ai";

/** Load the last 50 messages of a conversation as Customer/Agent turns for the model. */
export async function loadThread(conversationId: string): Promise<ThreadMsg[]> {
  const msgs = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { direction: true, text: true, type: true },
  });
  return msgs.map((m) => ({ direction: m.direction === "OUT" ? "OUT" : "IN", text: m.text, type: m.type }));
}
