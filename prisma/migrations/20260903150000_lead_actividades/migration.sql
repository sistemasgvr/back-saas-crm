-- CreateTable
CREATE TABLE "lead_actividades" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "tipo" VARCHAR(30) NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "programada_en" TIMESTAMPTZ NOT NULL,
    "programada_fin" TIMESTAMPTZ NOT NULL,
    "duracion_minutos" SMALLINT NOT NULL DEFAULT 60,
    "referencia_inmueble" VARCHAR(300),
    "modalidad" VARCHAR(20),
    "estado" VARCHAR(20) NOT NULL DEFAULT 'PROGRAMADA',
    "nota" VARCHAR(500),
    "asignado_usuario_id" UUID,
    "creado_por_usuario_id" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lead_actividades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_actividades_organizacion_id_programada_en_idx" ON "lead_actividades"("organizacion_id", "programada_en");

-- CreateIndex
CREATE INDEX "lead_actividades_lead_id_programada_en_idx" ON "lead_actividades"("lead_id", "programada_en");

-- CreateIndex
CREATE INDEX "lead_actividades_asignado_usuario_id_estado_programada_en_pr_idx" ON "lead_actividades"("asignado_usuario_id", "estado", "programada_en", "programada_fin");

-- CreateIndex
CREATE INDEX "lead_actividades_organizacion_id_estado_programada_en_idx" ON "lead_actividades"("organizacion_id", "estado", "programada_en");

-- AddForeignKey
ALTER TABLE "lead_actividades" ADD CONSTRAINT "lead_actividades_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_actividades" ADD CONSTRAINT "lead_actividades_asignado_usuario_id_fkey" FOREIGN KEY ("asignado_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_actividades" ADD CONSTRAINT "lead_actividades_creado_por_usuario_id_fkey" FOREIGN KEY ("creado_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
