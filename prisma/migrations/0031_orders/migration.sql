-- Orders from WhatsApp carts (V2 M5 §2.10). Additive + idempotent.

CREATE TABLE IF NOT EXISTS "Order" (
  "id"             TEXT NOT NULL,
  "clientId"       TEXT NOT NULL DEFAULT 'default',
  "conversationId" TEXT,
  "contactId"      TEXT,
  "phone"          TEXT NOT NULL,
  "catalogId"      TEXT,
  "items"          JSONB NOT NULL,
  "itemCount"      INTEGER NOT NULL DEFAULT 0,
  "total"          NUMERIC(12,2),
  "currency"       TEXT,
  "status"         TEXT NOT NULL DEFAULT 'NEW',
  "note"           TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Order_clientId_status_idx" ON "Order"("clientId", "status");
CREATE INDEX IF NOT EXISTS "Order_clientId_createdAt_idx" ON "Order"("clientId", "createdAt");
