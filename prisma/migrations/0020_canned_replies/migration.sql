-- Team collaboration (V2 §2.3) — per-client canned replies. Additive + idempotent.

CREATE TABLE IF NOT EXISTS "CannedReply" (
  "id"        TEXT NOT NULL,
  "clientId"  TEXT NOT NULL,
  "title"     TEXT NOT NULL,
  "shortcut"  TEXT,
  "body"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CannedReply_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CannedReply_clientId_title_key" ON "CannedReply"("clientId", "title");
CREATE INDEX IF NOT EXISTS "CannedReply_clientId_idx" ON "CannedReply"("clientId");
