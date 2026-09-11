-- WhatsApp usernames / BSUID (Meta 2026): el teléfono (wa_id) puede omitirse.
-- Identidad estable = business-scoped user ID (user_id / from_user_id).

ALTER TABLE "whatsapp_conversaciones"
  ALTER COLUMN "wa_id" DROP NOT NULL;

ALTER TABLE "whatsapp_conversaciones"
  ADD COLUMN IF NOT EXISTS "bsuid" VARCHAR(128),
  ADD COLUMN IF NOT EXISTS "username" VARCHAR(100);

-- Índice único parcial: un BSUID por org cuando existe.
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_conversaciones_org_bsuid_key"
  ON "whatsapp_conversaciones" ("organizacion_id", "bsuid")
  WHERE "bsuid" IS NOT NULL;

-- wa_id sigue único por org cuando hay teléfono (el @@unique de Prisma
-- permite varios NULL en PostgreSQL).
CREATE INDEX IF NOT EXISTS "whatsapp_conversaciones_bsuid_idx"
  ON "whatsapp_conversaciones" ("bsuid");
