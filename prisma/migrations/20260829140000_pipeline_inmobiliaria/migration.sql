-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "estado_gestion" VARCHAR(40) NOT NULL DEFAULT 'NUEVO',
ADD COLUMN     "estado_gestion_en" TIMESTAMPTZ,
ADD COLUMN     "estado_gestion_por_usuario_id" UUID,
ADD COLUMN     "motivo_cierre" VARCHAR(80),
ADD COLUMN     "nota_cierre" VARCHAR(500);

-- CreateTable
CREATE TABLE "lead_estado_historial" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "tipo_lead" VARCHAR(40),
    "desde" VARCHAR(40),
    "hacia" VARCHAR(40) NOT NULL,
    "motivo_cierre" VARCHAR(80),
    "nota" VARCHAR(500),
    "usuario_id" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_estado_historial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_estado_historial_lead_id_fecha_creacion_idx" ON "lead_estado_historial"("lead_id", "fecha_creacion");

-- CreateIndex
CREATE INDEX "lead_estado_historial_organizacion_id_idx" ON "lead_estado_historial"("organizacion_id");

-- CreateIndex
CREATE INDEX "leads_estado_gestion_idx" ON "leads"("estado_gestion");

-- CreateIndex
CREATE INDEX "leads_organizacion_id_estado_gestion_idx" ON "leads"("organizacion_id", "estado_gestion");

-- CreateIndex
CREATE INDEX "leads_organizacion_id_tipo_lead_estado_gestion_idx" ON "leads"("organizacion_id", "tipo_lead", "estado_gestion");

-- AddForeignKey
ALTER TABLE "lead_estado_historial" ADD CONSTRAINT "lead_estado_historial_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill (PLAN-PIPELINE-INMOBILIARIA.md §9, Fase 20.1): leads existentes ya
-- asignados arrancan en CONTACTADO (alguien ya los tiene), el resto se queda
-- en el default NUEVO. No se fabrica lead_estado_historial retroactivo: no
-- sabemos la fecha real de "contactado" de leads viejos, y una entrada con
-- fecha inventada sería peor que no tener historial previo a este cambio.
UPDATE "leads"
SET "estado_gestion" = 'CONTACTADO'
WHERE "asignado_usuario_id" IS NOT NULL
  AND "estado_gestion" = 'NUEVO';

