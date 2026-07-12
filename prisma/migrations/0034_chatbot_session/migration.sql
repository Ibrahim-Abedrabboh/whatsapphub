-- Running chatbot sessions (V2 M3 Phase 4). Additive + idempotent.

CREATE TABLE IF NOT EXISTS "ChatbotSession" (
  "id"             TEXT NOT NULL,
  "clientId"       TEXT NOT NULL DEFAULT 'default',
  "conversationId" TEXT NOT NULL,
  "chatbotId"      TEXT NOT NULL,
  "currentNodeId"  TEXT NOT NULL,
  "variables"      JSONB NOT NULL DEFAULT '{}',
  "status"         TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatbotSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChatbotSession_conversationId_idx" ON "ChatbotSession"("conversationId");
CREATE INDEX IF NOT EXISTS "ChatbotSession_clientId_idx" ON "ChatbotSession"("clientId");
