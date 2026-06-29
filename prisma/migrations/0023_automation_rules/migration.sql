-- Automation (V2 M3 §2.5) — no-code inbound rules. Additive + idempotent.

CREATE TABLE IF NOT EXISTS "AutomationRule" (
  "id"        TEXT NOT NULL,
  "clientId"  TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "enabled"   BOOLEAN NOT NULL DEFAULT true,
  "trigger"   JSONB NOT NULL,
  "action"    JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AutomationRule_clientId_name_key" ON "AutomationRule"("clientId", "name");
CREATE INDEX IF NOT EXISTS "AutomationRule_clientId_enabled_idx" ON "AutomationRule"("clientId", "enabled");
