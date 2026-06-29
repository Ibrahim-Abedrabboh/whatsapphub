-- Team collaboration (V2 §2.3) — conversation status + agent assignment.
-- Additive + idempotent: existing rows backfill to status='OPEN', assignee NULL.

ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'OPEN';
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "firstResponseAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);

-- Assignee FK → User; SET NULL so deleting a user just unassigns their threads.
DO $$ BEGIN
  ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Conversation_clientId_status_idx" ON "Conversation"("clientId", "status");
CREATE INDEX IF NOT EXISTS "Conversation_clientId_assignedToId_idx" ON "Conversation"("clientId", "assignedToId");
