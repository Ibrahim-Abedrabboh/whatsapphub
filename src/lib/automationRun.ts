// Orchestrates inbound automation (V2 M3 §2.5): loads a client's enabled rules,
// evaluates them (pure, automation.ts), and fires the first sendText action —
// guarded against opt-outs and reply loops. Best-effort: callers wrap in catch
// so a failure never blocks inbound recording.

import { prisma } from "./db";
import { connection } from "./queue";
import { getChannel } from "./channels";
import { evaluateRules, type AutomationRuleDef } from "./automation";

const COOLDOWN_SECONDS = 300; // one auto-reply per peer per 5 minutes

export async function runAutomation(clientId: string, channel: string, peer: string, text: string): Promise<void> {
  const rows = await prisma.automationRule.findMany({
    where: { clientId, enabled: true },
    select: { trigger: true, action: true },
  });
  if (rows.length === 0) return;

  const rules: AutomationRuleDef[] = rows.map((r) => ({
    enabled: true,
    trigger: r.trigger as unknown as AutomationRuleDef["trigger"],
    action: r.action as unknown as AutomationRuleDef["action"],
  }));
  const send = evaluateRules(rules, { text, now: new Date() }).find((a) => a.type === "sendText");
  if (!send) return;

  // Never auto-reply to an opted-out contact.
  const opted = await prisma.optOut
    .findUnique({ where: { clientId_phone: { clientId, phone: peer } }, select: { id: true } })
    .catch(() => null);
  if (opted) return;

  // Loop + spam guard: claim a short cooldown before sending.
  const claimed = await connection.set(`auto:${channel}:${clientId}:${peer}`, "1", "EX", COOLDOWN_SECONDS, "NX");
  if (claimed !== "OK") return;

  const wamid = await getChannel(channel).sendText({ to: peer, body: send.body, clientId });

  // Reflect the auto-reply in the conversation thread.
  const convo = await prisma.conversation
    .findUnique({ where: { clientId_channel_phone: { clientId, channel, phone: peer } }, select: { id: true } })
    .catch(() => null);
  if (convo) {
    const now = new Date();
    await prisma.message.create({
      data: { clientId, conversationId: convo.id, channel, direction: "OUT", type: "text", text: send.body, wamid, status: "SENT" },
    });
    await prisma.conversation.update({ where: { id: convo.id }, data: { lastMessageAt: now, lastPreview: send.body } });
  }
}
