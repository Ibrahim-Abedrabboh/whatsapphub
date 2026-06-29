// Messenger (Facebook Page) channel adapter. Mirrors the Instagram adapter — the
// Messenger Platform shares the same "messaging" webhook shape and a send-by-URL
// media model — differing only in the Send API body (messaging_type) and that the
// asset is a Page id. Dark until a ChannelConnection(channel="MESSENGER") exists.

import { getPageConfig } from "@/lib/pageConfig";
import { type InboundMessage } from "@/lib/inboundMessage";
import { type ChannelAdapter, type MediaType, windowOpen, DAY_MS } from "./types";

const GRAPH = "https://graph.facebook.com";

export interface MsgrAttachment {
  type?: string;
  payload?: { url?: string };
}
export interface MsgrMessaging {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: { mid?: string; text?: string; is_echo?: boolean; attachments?: MsgrAttachment[] };
}

const ATTACH_FIELD: Record<string, "image" | "video" | "audio" | "document"> = {
  image: "image", video: "video", audio: "audio", file: "document",
};

/** Pure: map one Messenger `messaging` event into our InboundMessage shape.
 *  Returns null for echoes of our own outbound and senderless events. */
export function normalizeMessengerInbound(m: MsgrMessaging): InboundMessage | null {
  const from = m.sender?.id;
  if (!from || m.message?.is_echo) return null;
  const id = m.message?.mid;
  const text = m.message?.text;
  if (text) return { from, id, type: "text", text: { body: text } };

  const att = m.message?.attachments?.[0];
  const url = att?.payload?.url;
  const field = att?.type ? ATTACH_FIELD[att.type] : undefined;
  if (field && url) {
    return { from, id, type: field, [field]: { id: url } } as InboundMessage;
  }
  return { from, id, type: att?.type || "text" };
}

/** Pure send-payload builders (unit-tested without network). */
export function buildMsgrTextPayload(to: string, body: string) {
  return { recipient: { id: to }, messaging_type: "RESPONSE", message: { text: body } };
}
export function buildMsgrMediaPayload(to: string, type: MediaType, url: string) {
  return {
    recipient: { id: to },
    messaging_type: "RESPONSE",
    message: { attachment: { type, payload: { url, is_reusable: true } } },
  };
}

async function postMessages(clientId: string, payload: unknown): Promise<string> {
  const cfg = await getPageConfig(clientId);
  const res = await fetch(`${GRAPH}/${cfg.graphApiVersion}/${cfg.pageId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as { message_id?: string; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message ?? `Messenger send failed (${res.status})`);
  if (!json.message_id) throw new Error("No message_id in Messenger response");
  return json.message_id;
}

export const messengerAdapter: ChannelAdapter = {
  channel: "MESSENGER",
  windowMs: DAY_MS,
  isWindowOpen(lastInboundAt) {
    return windowOpen(lastInboundAt, DAY_MS);
  },
  sendText({ to, body, clientId }) {
    return postMessages(clientId, buildMsgrTextPayload(to, body));
  },
  sendMedia(args) {
    if (!args.mediaUrl) throw new Error("Messenger sendMedia requires a mediaUrl (it sends media by URL)");
    return postMessages(args.clientId, buildMsgrMediaPayload(args.to, args.type, args.mediaUrl));
  },
  uploadMedia() {
    return Promise.reject(new Error("Messenger does not support direct media upload; send by URL"));
  },
  async fetchMediaBytes(mediaId) {
    // For Messenger, mediaId holds the inbound CDN URL.
    const res = await fetch(mediaId);
    if (!res.ok) return null;
    return { bytes: await res.arrayBuffer(), mime: res.headers.get("content-type") || "application/octet-stream" };
  },
};
