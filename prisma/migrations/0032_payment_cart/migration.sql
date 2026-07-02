-- Payment links + abandoned-cart reminders (V2 M5 §2.10 Phase 4).
-- Additive + idempotent.

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "remindedAt" TIMESTAMP(3);
