import { prisma } from "./db";
import { normalizeInbound, previewFor, type InboundMessage } from "./inboundMessage";
import { type Channel } from "./channels/types";
import { buildInboundWrites, shouldLinkContact } from "./inboundWrites";

export type { InboundMessage };
export { buildInboundWrites, shouldLinkContact } from "./inboundWrites";

/**
 * Record an inbound customer message into its conversation thread (per client,
 * per channel). Idempotent on the external message id — Meta retries webhooks,
 * and a retry must not double-count unread or duplicate the message.
 */
export async function recordInboundMessage(
  clientId: string,
  m: InboundMessage,
  channel: Channel = "WHATSAPP",
): Promise<void> {
  if (m.id) {
    const existing = await prisma.message.findUnique({ where: { wamid: m.id }, select: { id: true } });
    if (existing) return;
  }

  const n = normalizeInbound(m);
  const preview = previewFor(n);
  const contact = shouldLinkContact(channel)
    ? await prisma.contact.findFirst({ where: { clientId, phone: m.from }, select: { id: true } })
    : null;
  const now = new Date();

  const w = buildInboundWrites({
    clientId, channel, from: m.from, externalId: m.id ?? null,
    normalized: n, preview, contactId: contact?.id ?? null, now,
  });

  const convo = await prisma.conversation.upsert({ where: w.where, create: w.create, update: w.update });
  await prisma.message.create({ data: w.message(convo.id) });
}
