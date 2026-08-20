-- CreateTable
CREATE TABLE "meta_insights_diarios" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "meta_cuenta_publicitaria_id" UUID NOT NULL,
    "campana_id" UUID,
    "fecha" DATE NOT NULL,
    "spend" DECIMAL(14,4) NOT NULL,
    "impressions" BIGINT NOT NULL,
    "clicks" BIGINT NOT NULL,
    "ctr" DECIMAL(10,6),
    "cpc" DECIMAL(14,4),
    "reach" BIGINT,
    "moneda" VARCHAR(8),
    "datos_crudos" JSONB,
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "usuario_edicion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "meta_insights_diarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meta_insights_diarios_organizacion_id_meta_cuenta_publicita_idx" ON "meta_insights_diarios"("organizacion_id", "meta_cuenta_publicitaria_id", "fecha");

-- CreateIndex
CREATE INDEX "meta_insights_diarios_campana_id_idx" ON "meta_insights_diarios"("campana_id");

-- CreateIndex
CREATE INDEX "meta_insights_diarios_fecha_idx" ON "meta_insights_diarios"("fecha");

-- CreateIndex
CREATE INDEX "meta_insights_diarios_estado_idx" ON "meta_insights_diarios"("estado");

-- AddForeignKey
ALTER TABLE "meta_insights_diarios" ADD CONSTRAINT "meta_insights_diarios_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_insights_diarios" ADD CONSTRAINT "meta_insights_diarios_meta_cuenta_publicitaria_id_fkey" FOREIGN KEY ("meta_cuenta_publicitaria_id") REFERENCES "meta_cuentas_publicitarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_insights_diarios" ADD CONSTRAINT "meta_insights_diarios_campana_id_fkey" FOREIGN KEY ("campana_id") REFERENCES "campanas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
