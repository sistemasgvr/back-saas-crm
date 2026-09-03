-- AlterTable
ALTER TABLE "lead_auto_asignacion_config" ADD COLUMN "usuario_ids" JSONB;

-- Backfill de compatibilidad:
-- si el config anterior solo tenía 2 usuarios (usuario_primero_id/usuario_segundo_id),
-- entonces `usuario_ids` queda vacío/null; lo rellenamos con ambos IDs.
UPDATE "lead_auto_asignacion_config"
SET "usuario_ids" = jsonb_build_array(
  "usuario_primero_id",
  "usuario_segundo_id"
)
WHERE COALESCE(jsonb_array_length("usuario_ids"), 0) = 0;

