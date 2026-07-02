-- A/B testing (V2 M4 §2.7) — a broadcast can have a linked "B" variant.
-- Additive + idempotent.

ALTER TABLE "Broadcast" ADD COLUMN IF NOT EXISTS "variantOf" TEXT;
ALTER TABLE "Broadcast" ADD COLUMN IF NOT EXISTS "variantLabel" TEXT;

DO $$ BEGIN
  ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_variantOf_fkey"
    FOREIGN KEY ("variantOf") REFERENCES "Broadcast"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Broadcast_variantOf_idx" ON "Broadcast"("variantOf");
