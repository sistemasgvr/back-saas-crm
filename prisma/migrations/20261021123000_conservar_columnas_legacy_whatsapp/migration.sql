BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- El respaldo de producción del 09/10/2026 contiene estas columnas fuera del
-- historial de migraciones. Se preservan sus valores y se reproducen en bases
-- nuevas; Prisma las ignora en el cliente. No copiar ni reactivar credenciales.
ALTER TABLE "whatsapp_conexiones"
  ADD COLUMN IF NOT EXISTS "business_id" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "origen" VARCHAR(40) NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "token_cifrado" TEXT,
  ADD COLUMN IF NOT EXISTS "token_expira_en" TIMESTAMPTZ;

COMMIT;
