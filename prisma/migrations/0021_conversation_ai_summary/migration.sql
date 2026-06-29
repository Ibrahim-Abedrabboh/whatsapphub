-- AI assist (V2 M3 §2.4) — store an on-demand Claude thread summary.
-- Additive + idempotent.

ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "aiSummary" TEXT;
