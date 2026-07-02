-- Number-quality monitoring + auto-pause (V2 M4 §2.9). Additive + idempotent.

CREATE TABLE IF NOT EXISTS "QualitySnapshot" (
  "id"            TEXT NOT NULL,
  "clientId"      TEXT NOT NULL DEFAULT 'default',
  "phoneNumberId" TEXT NOT NULL,
  "qualityRating" TEXT,
  "messagingTier" TEXT,
  "capturedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QualitySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "QualitySnapshot_clientId_capturedAt_idx" ON "QualitySnapshot"("clientId", "capturedAt");

ALTER TABLE "WhatsAppConfig" ADD COLUMN IF NOT EXISTS "sendPaused" BOOLEAN NOT NULL DEFAULT false;
