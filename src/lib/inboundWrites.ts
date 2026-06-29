// Pure builders for recording an inbound message into its conversation thread.
// No DB/IO imports, so this is unit-testable in isolation (repo convention).

import { type NormalizedMessage } from "./inboundMessage";
import { type Channel } from "./channels/types";

/** Contacts are phone-based, so we only link an inbound thread to a Contact on
 *  the WhatsApp channel (IG/Messenger peers are scoped ids, not phone numbers). */
export function shouldLinkContact(channel: Channel): boolean {
  return channel === "WHATSAPP";
}

export interface InboundWrites {
  where: { clientId_channel_phone: { clientId: string; channel: string; phone: string } };
  create: {
    clientId: string; channel: string; phone: string; contactId: string | null;
    lastInboundAt: Date; lastMessageAt: Date; lastPreview: string; unread: number;
  };
  update: {
    lastInboundAt: Date; lastMessageAt: Date; lastPreview: string;
    unread: { increment: number }; contactId?: string;
  };
  message: (conversationId: string) => {
    clientId: string; conversationId: string; channel: string; direction: "IN";
    type: string; text: string | null; mediaId: string | null; mediaMime: string | null;
    mediaFilename: string | null; wamid: string | null;
  };
}

/** Build the conversation upsert + message-create payloads for one inbound message. */
export function buildInboundWrites(args: {
  clientId: string; channel: Channel; from: string; externalId: string | null;
  normalized: NormalizedMessage; preview: string; contactId: string | null; now: Date;
}): InboundWrites {
  const { clientId, channel, from, externalId, normalized: n, preview, contactId, now } = args;
  return {
    where: { clientId_channel_phone: { clientId, channel, phone: from } },
    create: {
      clientId, channel, phone: from, contactId: contactId ?? null,
      lastInboundAt: now, lastMessageAt: now, lastPreview: preview, unread: 1,
    },
    update: {
      lastInboundAt: now, lastMessageAt: now, lastPreview: preview,
      unread: { increment: 1 },
      ...(contactId ? { contactId } : {}),
    },
    message: (conversationId) => ({
      clientId, conversationId, channel, direction: "IN",
      type: n.type, text: n.text, mediaId: n.mediaId, mediaMime: n.mediaMime,
      mediaFilename: n.mediaFilename, wamid: externalId,
    }),
  };
}
