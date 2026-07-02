-- Link-click tracking (V2 M4 §2.9) — short links + click log for the public
-- /r/[code] redirect. Additive + idempotent.

CREATE TABLE IF NOT EXISTS "ShortLink" (
  "id"          TEXT NOT NULL,
  "clientId"    TEXT NOT NULL DEFAULT 'default',
  "code"        TEXT NOT NULL,
  "targetUrl"   TEXT NOT NULL,
  "broadcastId" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShortLink_code_key" ON "ShortLink"("code");
CREATE INDEX IF NOT EXISTS "ShortLink_broadcastId_idx" ON "ShortLink"("broadcastId");

CREATE TABLE IF NOT EXISTS "LinkClick" (
  "id"          TEXT NOT NULL,
  "shortLinkId" TEXT NOT NULL,
  "contactId"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LinkClick_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_shortLinkId_fkey"
    FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "LinkClick_shortLinkId_idx" ON "LinkClick"("shortLinkId");
