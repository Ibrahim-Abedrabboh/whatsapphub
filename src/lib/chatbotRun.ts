import { prisma } from "@/lib/db";
import { getChannel } from "@/lib/channels";
import { chatbotQueue } from "@/lib/queue";
import type { ChatbotFlow } from "@/lib/validation";
import { startRun, advance, resume, type SessionState, type AdvanceResult } from "@/lib/chatbot";
import { buildResponder, substitutionVars } from "@/lib/chatbotResponder";
import { loadThread } from "@/lib/aiThread";
import { threadToTranscript } from "@/lib/ai";

// Orchestrates chatbot sessions in the inbound path (V2 M3 Phase 4). Persists
// sessions, wires the real Claude+KB responder, and sends via the channel
// adapter. Best-effort — callers wrap in catch so a failure never blocks ack.

async function resolveConversation(clientId: string, channel: string, peer: string) {
  return prisma.conversation.findUnique({
    where: { clientId_channel_phone: { clientId, channel, phone: peer } },
    select: { id: true, contact: { select: { name: true } } },
  }).catch(() => null);
}

async function sendAll(clientId: string, channel: string, peer: string, conversationId: string | null, outbound: string[]) {
  for (const body of outbound) {
    if (!body.trim()) continue;
    const wamid = await getChannel(channel).sendText({ to: peer, body, clientId }).catch(() => null);
    if (conversationId) {
      await prisma.message.create({ data: { clientId, conversationId, channel, direction: "OUT", type: "text", text: body, wamid: wamid ?? null, status: "SENT" } });
      await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date(), lastPreview: body } });
    }
  }
}

const transcriptLoader = (conversationId: string) => async () => threadToTranscript(await loadThread(conversationId));

/** When a walk paused on a delay node, enqueue a delayed resume for this session. */
async function scheduleResume(sessionId: string, result: AdvanceResult): Promise<void> {
  if (result.delayMs && !result.done) {
    await chatbotQueue.add("resume", { sessionId }, { delay: result.delayMs }).catch(() => {});
  }
}

/** If an ACTIVE session owns this conversation, advance it and return true. */
export async function interceptActiveSession(clientId: string, channel: string, peer: string, text: string): Promise<boolean> {
  const convo = await resolveConversation(clientId, channel, peer);
  if (!convo) return false;
  const row = await prisma.chatbotSession.findFirst({ where: { clientId, conversationId: convo.id, status: "ACTIVE" }, orderBy: { updatedAt: "desc" } });
  if (!row) return false;

  const bot = await prisma.chatbot.findFirst({ where: { id: row.chatbotId, clientId }, select: { flow: true } });
  if (!bot) { await prisma.chatbotSession.update({ where: { id: row.id }, data: { status: "ABANDONED" } }); return true; }

  const responder = await buildResponder(clientId, transcriptLoader(convo.id));
  const session: SessionState = { currentNodeId: row.currentNodeId, variables: (row.variables as Record<string, string>) ?? {}, status: "ACTIVE" };
  const result = await advance(bot.flow as unknown as ChatbotFlow, session, text, responder);

  await sendAll(clientId, channel, peer, convo.id, result.outbound);
  await prisma.chatbotSession.update({
    where: { id: row.id },
    data: { currentNodeId: result.session.currentNodeId, variables: result.session.variables, status: result.done ? "DONE" : "ACTIVE" },
  });
  await scheduleResume(row.id, result);
  return true;
}

/** Create a session for `chatbotId` on this conversation and run its opening nodes. */
export async function startChatbotSession(clientId: string, channel: string, peer: string, chatbotId: string): Promise<void> {
  const convo = await resolveConversation(clientId, channel, peer);
  if (!convo) return;
  const bot = await prisma.chatbot.findFirst({ where: { id: chatbotId, clientId }, select: { flow: true } });
  if (!bot) return;

  // One ACTIVE session per conversation: retire any prior.
  await prisma.chatbotSession.updateMany({ where: { clientId, conversationId: convo.id, status: "ACTIVE" }, data: { status: "ABANDONED" } });

  const responder = await buildResponder(clientId, transcriptLoader(convo.id));
  const vars = substitutionVars(convo.contact?.name ?? null, peer);
  const result = await startRun(bot.flow as unknown as ChatbotFlow, responder, vars);

  await sendAll(clientId, channel, peer, convo.id, result.outbound);
  const created = await prisma.chatbotSession.create({
    data: { clientId, conversationId: convo.id, chatbotId, currentNodeId: result.session.currentNodeId, variables: result.session.variables, status: result.done ? "DONE" : "ACTIVE" },
    select: { id: true },
  });
  await scheduleResume(created.id, result);
}

/** Worker entry: a delay timer elapsed — continue the session from after the delay.
 *  Idempotent + safe: skips unless the session is still ACTIVE (agent takeover or
 *  completion abandons/finishes it). */
export async function resumeChatbotSession(sessionId: string): Promise<void> {
  const row = await prisma.chatbotSession.findUnique({ where: { id: sessionId } });
  if (!row || row.status !== "ACTIVE") return;

  const [bot, convo] = await Promise.all([
    prisma.chatbot.findFirst({ where: { id: row.chatbotId, clientId: row.clientId }, select: { flow: true } }),
    prisma.conversation.findUnique({ where: { id: row.conversationId }, select: { channel: true, phone: true } }).catch(() => null),
  ]);
  if (!bot) { await prisma.chatbotSession.update({ where: { id: row.id }, data: { status: "ABANDONED" } }); return; }
  if (!convo) return;

  const responder = await buildResponder(row.clientId, transcriptLoader(row.conversationId));
  const session: SessionState = { currentNodeId: row.currentNodeId, variables: (row.variables as Record<string, string>) ?? {}, status: "ACTIVE" };
  const result = await resume(bot.flow as unknown as ChatbotFlow, session, responder);

  await sendAll(row.clientId, convo.channel, convo.phone, row.conversationId, result.outbound);
  await prisma.chatbotSession.update({
    where: { id: row.id },
    data: { currentNodeId: result.session.currentNodeId, variables: result.session.variables, status: result.done ? "DONE" : "ACTIVE" },
  });
  await scheduleResume(row.id, result);
}
