-- Dynamic segments (V2 M4 §2.7) — saved rule sets matched against contacts at
-- send/preview time. Additive + idempotent.

CREATE TABLE IF NOT EXISTS "Segment" (
  "id"        TEXT NOT NULL,
  "clientId"  TEXT NOT NULL DEFAULT 'default',
  "name"      TEXT NOT NULL,
  "rules"     JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Segment_clientId_name_key" ON "Segment"("clientId", "name");

-- A broadcast can now target a segment instead of a list.
ALTER TABLE "Broadcast" ADD COLUMN IF NOT EXISTS "segmentId" TEXT;
ALTER TABLE "Broadcast" ALTER COLUMN "listId" DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_segmentId_fkey"
    FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Broadcast_segmentId_idx" ON "Broadcast"("segmentId");
