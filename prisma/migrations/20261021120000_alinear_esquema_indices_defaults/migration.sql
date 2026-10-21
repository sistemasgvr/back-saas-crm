BEGIN;

-- Completa cambios declarados en Prisma sin eliminar datos ni restricciones.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "automatizacion_integraciones" ALTER COLUMN "id" SET DEFAULT 'n8n';

CREATE INDEX "meta_conexiones_meta_user_id_idx" ON "meta_conexiones"("meta_user_id");

COMMIT;
