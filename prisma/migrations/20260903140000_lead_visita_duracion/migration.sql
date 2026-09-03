-- AlterTable
ALTER TABLE "lead_visitas" ADD COLUMN "duracion_minutos" SMALLINT NOT NULL DEFAULT 60;
ALTER TABLE "lead_visitas" ADD COLUMN "programada_fin" TIMESTAMPTZ(6);

-- Backfill fin = inicio + duración
UPDATE "lead_visitas"
SET "programada_fin" = "programada_en" + (("duracion_minutos"::text || ' minutes')::interval)
WHERE "programada_fin" IS NULL;

ALTER TABLE "lead_visitas" ALTER COLUMN "programada_fin" SET NOT NULL;

-- CreateIndex
CREATE INDEX "lead_visitas_asignado_usuario_id_estado_programada_en_progra_idx" ON "lead_visitas"("asignado_usuario_id", "estado", "programada_en", "programada_fin");
