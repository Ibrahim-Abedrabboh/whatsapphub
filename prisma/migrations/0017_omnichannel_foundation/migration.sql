-- Omnichannel inbox (V2 §2.1) — channel-agnostic foundation.
-- Tag existing conversations/messages as WHATSAPP (the default labels every
-- existing row atomically — no separate UPDATE, no nullable window) and scope
-- conversation uniqueness per channel so other channels can share a peer id space.

ALTER TABLE "Conversation" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'WHATSAPP';
ALTER TABLE "Message"      ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'WHATSAPP';

-- Swap conversation uniqueness to per-channel. Safe: every existing row is now
-- WHATSAPP, so (clientId, 'WHATSAPP', phone) is exactly as unique as before.
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_clientId_phone_key";
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_clientId_channel_phone_key"
  UNIQUE ("clientId", "channel", "phone");

-- Per-client connection of a non-WhatsApp Meta messaging asset (IG / Page).
CREATE TABLE "ChannelConnection" (
  "id"              TEXT NOT NULL,
  "clientId"        TEXT NOT NULL DEFAULT 'default',
  "channel"         TEXT NOT NULL,
  "assetId"         TEXT NOT NULL,
  "pageId"          TEXT,
  "igBusinessId"    TEXT,
  "accessToken"     TEXT,
  "appSecret"       TEXT,
  "verifyToken"     TEXT,
  "graphApiVersion" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChannelConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChannelConnection_clientId_channel_key" ON "ChannelConnection"("clientId", "channel");
CREATE UNIQUE INDEX "ChannelConnection_channel_assetId_key"  ON "ChannelConnection"("channel", "assetId");
CREATE INDEX "ChannelConnection_clientId_idx" ON "ChannelConnection"("clientId");
