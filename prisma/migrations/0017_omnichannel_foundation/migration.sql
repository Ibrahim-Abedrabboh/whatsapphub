-- Omnichannel inbox (V2 §2.1) — channel-agnostic foundation.
-- Tag existing conversations/messages as WHATSAPP (the default labels every
-- existing row atomically — no separate UPDATE, no nullable window) and scope
-- conversation uniqueness per channel so other channels can share a peer id space.
--
-- Written idempotently (IF [NOT] EXISTS) so it can be safely re-applied after a
-- failed first attempt, regardless of how much of it had landed.

ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'WHATSAPP';
ALTER TABLE "Message"      ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'WHATSAPP';

-- Swap conversation uniqueness to per-channel. Safe: every existing row is now
-- WHATSAPP, so (clientId, 'WHATSAPP', phone) is exactly as unique as before.
-- NB: Prisma models @@unique as a UNIQUE INDEX (not a table constraint), so this
-- must DROP INDEX / CREATE UNIQUE INDEX — DROP CONSTRAINT errors with 42704.
DROP INDEX IF EXISTS "Conversation_clientId_phone_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_clientId_channel_phone_key"
  ON "Conversation"("clientId", "channel", "phone");

-- Per-client connection of a non-WhatsApp Meta messaging asset (IG / Page).
CREATE TABLE IF NOT EXISTS "ChannelConnection" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "ChannelConnection_clientId_channel_key" ON "ChannelConnection"("clientId", "channel");
CREATE UNIQUE INDEX IF NOT EXISTS "ChannelConnection_channel_assetId_key"  ON "ChannelConnection"("channel", "assetId");
CREATE INDEX IF NOT EXISTS "ChannelConnection_clientId_idx" ON "ChannelConnection"("clientId");
