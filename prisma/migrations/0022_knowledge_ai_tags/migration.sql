-- AI assist (V2 M3 §2.4) — FAQ knowledge base + per-message AI tags.
-- Additive + idempotent.

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "aiTags" JSONB;

CREATE TABLE IF NOT EXISTS "KnowledgeDoc" (
  "id"        TEXT NOT NULL,
  "clientId"  TEXT NOT NULL,
  "title"     TEXT NOT NULL,
  "content"   TEXT NOT NULL,
  "source"    TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeDoc_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeDoc_clientId_title_key" ON "KnowledgeDoc"("clientId", "title");
CREATE INDEX IF NOT EXISTS "KnowledgeDoc_clientId_idx" ON "KnowledgeDoc"("clientId");
