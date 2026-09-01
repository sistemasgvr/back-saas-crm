-- Fase 22: entidades estructuradas para agenda (visitas) y calificaciones
CREATE TABLE "lead_visitas" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "programada_en" TIMESTAMPTZ NOT NULL,
    "referencia_inmueble" VARCHAR(300) NOT NULL,
    "direccion" VARCHAR(300),
    "modalidad" VARCHAR(20) NOT NULL DEFAULT 'PRESENCIAL',
    "punto_encuentro" VARCHAR(300),
    "estado" VARCHAR(20) NOT NULL DEFAULT 'PROGRAMADA',
    "resultado" VARCHAR(20),
    "nota" VARCHAR(500),
    "feedback" VARCHAR(500),
    "historial_agendo_id" UUID,
    "historial_cierra_id" UUID,
    "asignado_usuario_id" UUID,
    "creado_por_usuario_id" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_visitas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lead_calificaciones" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "tipo_lead" VARCHAR(40),
    "presupuesto" VARCHAR(120),
    "zona" VARCHAR(120),
    "tipo_inmueble" VARCHAR(120),
    "tipo_propiedad" VARCHAR(120),
    "precio_referencia" VARCHAR(120),
    "nota" VARCHAR(500) NOT NULL,
    "historial_id" UUID,
    "usuario_id" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_calificaciones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lead_visitas_historial_agendo_id_key" ON "lead_visitas"("historial_agendo_id");
CREATE UNIQUE INDEX "lead_visitas_historial_cierra_id_key" ON "lead_visitas"("historial_cierra_id");
CREATE INDEX "lead_visitas_organizacion_id_programada_en_idx" ON "lead_visitas"("organizacion_id", "programada_en");
CREATE INDEX "lead_visitas_lead_id_programada_en_idx" ON "lead_visitas"("lead_id", "programada_en");
CREATE INDEX "lead_visitas_asignado_usuario_id_programada_en_idx" ON "lead_visitas"("asignado_usuario_id", "programada_en");
CREATE INDEX "lead_visitas_organizacion_id_estado_programada_en_idx" ON "lead_visitas"("organizacion_id", "estado", "programada_en");

CREATE UNIQUE INDEX "lead_calificaciones_historial_id_key" ON "lead_calificaciones"("historial_id");
CREATE INDEX "lead_calificaciones_lead_id_fecha_creacion_idx" ON "lead_calificaciones"("lead_id", "fecha_creacion");
CREATE INDEX "lead_calificaciones_organizacion_id_idx" ON "lead_calificaciones"("organizacion_id");

ALTER TABLE "lead_visitas" ADD CONSTRAINT "lead_visitas_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lead_visitas" ADD CONSTRAINT "lead_visitas_historial_agendo_id_fkey" FOREIGN KEY ("historial_agendo_id") REFERENCES "lead_estado_historial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lead_visitas" ADD CONSTRAINT "lead_visitas_historial_cierra_id_fkey" FOREIGN KEY ("historial_cierra_id") REFERENCES "lead_estado_historial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lead_visitas" ADD CONSTRAINT "lead_visitas_asignado_usuario_id_fkey" FOREIGN KEY ("asignado_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lead_visitas" ADD CONSTRAINT "lead_visitas_creado_por_usuario_id_fkey" FOREIGN KEY ("creado_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lead_calificaciones" ADD CONSTRAINT "lead_calificaciones_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lead_calificaciones" ADD CONSTRAINT "lead_calificaciones_historial_id_fkey" FOREIGN KEY ("historial_id") REFERENCES "lead_estado_historial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lead_calificaciones" ADD CONSTRAINT "lead_calificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
