// Channel-agnostic messaging adapter contract. Each Meta surface (WhatsApp,
// Instagram DM, Messenger) implements this so the inbox API, media proxy, and
// inbound recorder can dispatch by `conversation.channel` without caring which
// surface a thread lives on. See src/lib/channels/index.ts for the registry.

export type Channel = "WHATSAPP" | "INSTAGRAM" | "MESSENGER";

export const CHANNELS: readonly Channel[] = ["WHATSAPP", "INSTAGRAM", "MESSENGER"] as const;

export type MediaType = "image" | "document" | "audio" | "video";

export interface SendMediaArgs {
  to: string;
  type: MediaType;
  mediaId?: string; // WhatsApp: Graph media id
  mediaUrl?: string; // Instagram/Messenger: a publicly reachable URL
  caption?: string;
  filename?: string;
  clientId: string;
}

export interface ChannelAdapter {
  readonly channel: Channel;
  /** Length of the channel's free-form messaging window, in ms. */
  readonly windowMs: number;
  /** True when a free-form reply is still allowed (within the window). */
  isWindowOpen(lastInboundAt: Date | null): boolean;
  /** Send free-form text. Returns the external message id. */
  sendText(args: { to: string; body: string; clientId: string }): Promise<string>;
  /** Send a media message. Returns the external message id. */
  sendMedia(args: SendMediaArgs): Promise<string>;
  /** Upload bytes to the channel's media store; returns the media handle. */
  uploadMedia(bytes: ArrayBuffer, mime: string, filename: string, clientId: string): Promise<string>;
  /** Resolve an inbound media handle → bytes (token-safe; never exposes the token). */
  fetchMediaBytes(mediaId: string, clientId: string): Promise<{ bytes: ArrayBuffer; mime: string } | null>;
}

/** Pure window check shared by every adapter. */
export function windowOpen(lastInboundAt: Date | null, windowMs: number): boolean {
  if (!lastInboundAt) return false;
  return Date.now() - new Date(lastInboundAt).getTime() < windowMs;
}

/** Standard Meta customer-service window: 24 hours. */
export const DAY_MS = 24 * 60 * 60 * 1000;
