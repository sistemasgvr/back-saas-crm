-- CreateTable
CREATE TABLE "lead_auto_asignacion_config" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "habilitado" SMALLINT NOT NULL DEFAULT 0,
    "usuario_primero_id" UUID NOT NULL,
    "usuario_segundo_id" UUID NOT NULL,
    "siguiente_indice" SMALLINT NOT NULL DEFAULT 0,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_auto_asignacion_config_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lead_auto_asignacion_config_organizacion_id_unique" UNIQUE ("organizacion_id")
);

-- AddForeignKey
ALTER TABLE "lead_auto_asignacion_config" ADD CONSTRAINT "lead_auto_asignacion_config_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_auto_asignacion_config" ADD CONSTRAINT "lead_auto_asignacion_config_usuario_primero_id_fkey" FOREIGN KEY ("usuario_primero_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_auto_asignacion_config" ADD CONSTRAINT "lead_auto_asignacion_config_usuario_segundo_id_fkey" FOREIGN KEY ("usuario_segundo_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "lead_auto_asignacion_queue" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "fecha_lead" TIMESTAMPTZ NOT NULL,
    "fecha_encolado" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_auto_asignacion_queue_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "lead_auto_asignacion_queue" ADD CONSTRAINT "lead_auto_asignacion_queue_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_auto_asignacion_queue" ADD CONSTRAINT "lead_auto_asignacion_queue_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "lead_auto_asignacion_queue_organizacion_id_lead_id_key" ON "lead_auto_asignacion_queue"("organizacion_id", "lead_id");

-- CreateIndex
CREATE INDEX "lead_auto_asignacion_queue_organizacion_id_fecha_lead_fecha_encolado_idx" ON "lead_auto_asignacion_queue"("organizacion_id", "fecha_lead", "fecha_encolado");

