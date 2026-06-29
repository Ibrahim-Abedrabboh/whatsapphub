-- Team collaboration (V2 §2.3) — internal notes (agent-only, never sent).
-- Additive + idempotent.

CREATE TABLE IF NOT EXISTS "InternalNote" (
  "id"             TEXT NOT NULL,
  "clientId"       TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "authorId"       TEXT,
  "body"           TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "InternalNote_conversationId_createdAt_idx" ON "InternalNote"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "InternalNote_clientId_idx" ON "InternalNote"("clientId");
