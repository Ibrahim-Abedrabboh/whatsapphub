-- WhatsApp Flows (V2 M3 §2.5) — native in-chat forms. Additive + idempotent.

CREATE TABLE IF NOT EXISTS "Flow" (
  "id"         TEXT NOT NULL,
  "clientId"   TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "definition" JSONB NOT NULL,
  "metaId"     TEXT,
  "status"     TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Flow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Flow_clientId_name_key" ON "Flow"("clientId", "name");
CREATE INDEX IF NOT EXISTS "Flow_clientId_idx" ON "Flow"("clientId");
