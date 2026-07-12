-- No-code chatbot definitions (V2 M3). Additive + idempotent.

CREATE TABLE IF NOT EXISTS "Chatbot" (
  "id"        TEXT NOT NULL,
  "clientId"  TEXT NOT NULL DEFAULT 'default',
  "name"      TEXT NOT NULL,
  "flow"      JSONB NOT NULL,
  "status"    TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Chatbot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Chatbot_clientId_name_key" ON "Chatbot"("clientId", "name");
CREATE INDEX IF NOT EXISTS "Chatbot_clientId_idx" ON "Chatbot"("clientId");
