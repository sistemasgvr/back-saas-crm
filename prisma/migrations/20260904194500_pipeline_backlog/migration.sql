-- AlterTable
ALTER TABLE "organizaciones" ADD COLUMN "pipeline_config" JSONB;

-- CreateTable
CREATE TABLE "inmuebles" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "codigo" VARCHAR(80) NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "tipo" VARCHAR(40) NOT NULL,
    "operacion" VARCHAR(20) NOT NULL,
    "zona" VARCHAR(120),
    "direccion" VARCHAR(300),
    "precio" DECIMAL(14,2),
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'PEN',
    "estado_inmueble" VARCHAR(20) NOT NULL DEFAULT 'DISPONIBLE',
    "notas" TEXT,
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "usuario_edicion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "inmuebles_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "leads" ADD COLUMN "inmueble_interes_id" UUID;

-- AlterTable
ALTER TABLE "lead_visitas" ADD COLUMN "inmueble_id" UUID;

-- AlterTable
ALTER TABLE "agenda_recordatorios_enviados" ADD COLUMN "whatsapp_enviado" SMALLINT NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "inmuebles_organizacion_id_codigo_key" ON "inmuebles"("organizacion_id", "codigo");

-- CreateIndex
CREATE INDEX "inmuebles_organizacion_id_estado_idx" ON "inmuebles"("organizacion_id", "estado");

-- CreateIndex
CREATE INDEX "inmuebles_organizacion_id_estado_inmueble_idx" ON "inmuebles"("organizacion_id", "estado_inmueble");

-- CreateIndex
CREATE INDEX "inmuebles_organizacion_id_operacion_idx" ON "inmuebles"("organizacion_id", "operacion");

-- CreateIndex
CREATE INDEX "leads_inmueble_interes_id_idx" ON "leads"("inmueble_interes_id");

-- CreateIndex
CREATE INDEX "lead_visitas_inmueble_id_idx" ON "lead_visitas"("inmueble_id");

-- AddForeignKey
ALTER TABLE "inmuebles" ADD CONSTRAINT "inmuebles_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_inmueble_interes_id_fkey" FOREIGN KEY ("inmueble_interes_id") REFERENCES "inmuebles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_visitas" ADD CONSTRAINT "lead_visitas_inmueble_id_fkey" FOREIGN KEY ("inmueble_id") REFERENCES "inmuebles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
