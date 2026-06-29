// Instagram DM channel adapter. Instagram Messaging sends by recipient IGSID and
// delivers inbound media as CDN URLs (no separate media-id step), so:
//   - outbound media is sent by URL (mediaUrl), not an uploaded media id;
//   - inbound media URLs are stored in Message.mediaId and fetched directly.
// Dark until a ChannelConnection(channel="INSTAGRAM") exists AND it's registered
// in ./index — see getChannel.

import { getIgConfig } from "@/lib/igConfig";
import { type InboundMessage } from "@/lib/inboundMessage";
import { type ChannelAdapter, type MediaType, windowOpen, DAY_MS } from "./types";

const GRAPH = "https://graph.facebook.com";

export interface IgAttachment {
  type?: string;
  payload?: { url?: string };
}
export interface IgMessaging {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: { mid?: string; text?: string; is_echo?: boolean; attachments?: IgAttachment[] };
}

// Map an IG attachment type to the InboundMessage media field normalizeInbound reads.
const ATTACH_FIELD: Record<string, "image" | "video" | "audio" | "document"> = {
  image: "image", video: "video", audio: "audio", file: "document",
};

/** Pure: map one IG `messaging` event into our channel-agnostic InboundMessage.
 *  Returns null for echoes of our own outbound and senderless events. */
export function normalizeInstagramInbound(m: IgMessaging): InboundMessage | null {
  const from = m.sender?.id;
  if (!from || m.message?.is_echo) return null;
  const id = m.message?.mid;
  const text = m.message?.text;
  if (text) return { from, id, type: "text", text: { body: text } };

  const att = m.message?.attachments?.[0];
  const url = att?.payload?.url;
  const field = att?.type ? ATTACH_FIELD[att.type] : undefined;
  if (field && url) {
    // Store the CDN URL where normalizeInbound expects a media id; the adapter's
    // fetchMediaBytes fetches that URL directly.
    return { from, id, type: field, [field]: { id: url } } as InboundMessage;
  }
  // Unknown/unsupported attachment → a typed placeholder with no media.
  return { from, id, type: att?.type || "text" };
}

/** Pure send-payload builders (unit-tested without network). */
export function buildIgTextPayload(to: string, body: string) {
  return { recipient: { id: to }, message: { text: body } };
}
export function buildIgMediaPayload(to: string, type: MediaType, url: string) {
  return { recipient: { id: to }, message: { attachment: { type, payload: { url, is_reusable: true } } } };
}

async function postMessages(clientId: string, payload: unknown): Promise<string> {
  const cfg = await getIgConfig(clientId);
  const res = await fetch(`${GRAPH}/${cfg.graphApiVersion}/${cfg.igBusinessId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as { message_id?: string; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message ?? `IG send failed (${res.status})`);
  if (!json.message_id) throw new Error("No message_id in Instagram response");
  return json.message_id;
}

export const instagramAdapter: ChannelAdapter = {
  channel: "INSTAGRAM",
  windowMs: DAY_MS,
  isWindowOpen(lastInboundAt) {
    return windowOpen(lastInboundAt, DAY_MS);
  },
  sendText({ to, body, clientId }) {
    return postMessages(clientId, buildIgTextPayload(to, body));
  },
  sendMedia(args) {
    if (!args.mediaUrl) throw new Error("Instagram sendMedia requires a mediaUrl (it sends media by URL)");
    return postMessages(args.clientId, buildIgMediaPayload(args.to, args.type, args.mediaUrl));
  },
  uploadMedia() {
    // Instagram has no upload step — media is sent by public URL. Agent file
    // uploads would need a hosting step first (out of scope for the dark-ship).
    return Promise.reject(new Error("Instagram does not support direct media upload; send by URL"));
  },
  async fetchMediaBytes(mediaId) {
    // For Instagram, mediaId holds the inbound CDN URL.
    const res = await fetch(mediaId);
    if (!res.ok) return null;
    return { bytes: await res.arrayBuffer(), mime: res.headers.get("content-type") || "application/octet-stream" };
  },
};
