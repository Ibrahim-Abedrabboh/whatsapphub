-- Commerce (V2 M5 §2.10) — catalog connection + synced products.
-- Additive + idempotent.

CREATE TABLE IF NOT EXISTS "CommerceCatalog" (
  "id"            TEXT NOT NULL,
  "clientId"      TEXT NOT NULL DEFAULT 'default',
  "metaCatalogId" TEXT NOT NULL,
  "name"          TEXT,
  "lastSyncedAt"  TIMESTAMP(3),
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommerceCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CommerceCatalog_clientId_key" ON "CommerceCatalog"("clientId");

CREATE TABLE IF NOT EXISTS "Product" (
  "id"           TEXT NOT NULL,
  "clientId"     TEXT NOT NULL DEFAULT 'default',
  "retailerId"   TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "priceText"    TEXT,
  "currency"     TEXT,
  "imageUrl"     TEXT,
  "availability" TEXT,
  "raw"          JSONB,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Product_clientId_retailerId_key" ON "Product"("clientId", "retailerId");
CREATE INDEX IF NOT EXISTS "Product_clientId_idx" ON "Product"("clientId");
