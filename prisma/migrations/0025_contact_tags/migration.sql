-- Contact 360 (V2 M4 §2.6) — editable tags on a contact. Additive + idempotent.

ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "tags" JSONB NOT NULL DEFAULT '[]';
