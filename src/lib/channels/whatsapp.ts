// WhatsApp channel adapter — a thin wrapper over the existing lib/whatsapp.ts
// Cloud API client. Behaviour is identical to the pre-omnichannel code path.

import { sendText, sendMedia, uploadMedia, fetchMediaBytes } from "@/lib/whatsapp";
import { type ChannelAdapter, type SendMediaArgs, windowOpen, DAY_MS } from "./types";

export const whatsappAdapter: ChannelAdapter = {
  channel: "WHATSAPP",
  windowMs: DAY_MS,
  isWindowOpen(lastInboundAt) {
    return windowOpen(lastInboundAt, DAY_MS);
  },
  sendText(args) {
    return sendText(args);
  },
  sendMedia(args: SendMediaArgs) {
    if (!args.mediaId) throw new Error("WhatsApp sendMedia requires a mediaId");
    return sendMedia({
      to: args.to,
      type: args.type,
      mediaId: args.mediaId,
      caption: args.caption,
      filename: args.filename,
      clientId: args.clientId,
    });
  },
  uploadMedia(bytes, mime, filename, clientId) {
    return uploadMedia(bytes, mime, filename, clientId);
  },
  fetchMediaBytes(mediaId, clientId) {
    return fetchMediaBytes(mediaId, clientId);
  },
};
