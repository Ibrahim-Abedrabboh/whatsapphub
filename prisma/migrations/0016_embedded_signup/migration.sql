-- Embedded Signup (V2 M1): mark connections established via Meta's one-click
-- OAuth flow and record the system-user token's expiry (null = long-lived).
ALTER TABLE "WhatsAppConfig" ADD COLUMN "wabaAutoConnected" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WhatsAppConfig" ADD COLUMN "tokenExpiresAt" TIMESTAMP(3);
