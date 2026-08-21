-- G3: WhatsApp Cloud API — whatsapp_conexiones / whatsapp_conversaciones / whatsapp_mensajes.
-- PLAN-GESTION-LEADS-WHATSAPP.md §4.3. Generado con `prisma migrate diff` contra la BD
-- real (no `migrate dev`, para evitar el drift de checksum ya conocido en este repo).
-- Las DropForeignKey/AddForeignKey de leads solo corrigen ON DELETE SET NULL (la
-- migración G2 no lo especificaba explícito) — no afectan filas existentes.

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_asignado_por_usuario_id_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_asignado_usuario_id_fkey";

-- CreateTable
CREATE TABLE "whatsapp_conexiones" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "meta_conexion_id" UUID NOT NULL,
    "waba_id" VARCHAR(64) NOT NULL,
    "phone_number_id" VARCHAR(64) NOT NULL,
    "numero_display" VARCHAR(40),
    "nombre_verificado" VARCHAR(255),
    "estado_numero" VARCHAR(40),
    "webhook_suscrito" SMALLINT NOT NULL DEFAULT 0,
    "webhook_suscrito_en" TIMESTAMPTZ,
    "webhook_ultimo_check_en" TIMESTAMPTZ,
    "webhook_ultimo_error" TEXT,
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "usuario_edicion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "whatsapp_conexiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_conversaciones" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "whatsapp_conexion_id" UUID NOT NULL,
    "lead_id" UUID,
    "wa_id" VARCHAR(40) NOT NULL,
    "nombre_contacto" VARCHAR(200),
    "ultimo_mensaje_en" TIMESTAMPTZ,
    "ventana_expira_en" TIMESTAMPTZ,
    "no_leidos" INTEGER NOT NULL DEFAULT 0,
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "usuario_edicion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "whatsapp_conversaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_mensajes" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "whatsapp_conversacion_id" UUID NOT NULL,
    "wamid" VARCHAR(128) NOT NULL,
    "direccion" VARCHAR(10) NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "texto" TEXT,
    "plantilla_nombre" VARCHAR(200),
    "estado_entrega" VARCHAR(20),
    "error_mensaje" TEXT,
    "datos_crudos" JSONB NOT NULL,
    "fecha_mensaje" TIMESTAMPTZ NOT NULL,
    "usuario_creacion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_mensajes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_conexiones_organizacion_id_phone_number_id_idx" ON "whatsapp_conexiones"("organizacion_id", "phone_number_id");

-- CreateIndex
CREATE INDEX "whatsapp_conexiones_estado_idx" ON "whatsapp_conexiones"("estado");

-- CreateIndex
CREATE INDEX "whatsapp_conversaciones_lead_id_idx" ON "whatsapp_conversaciones"("lead_id");

-- CreateIndex
CREATE INDEX "whatsapp_conversaciones_whatsapp_conexion_id_idx" ON "whatsapp_conversaciones"("whatsapp_conexion_id");

-- CreateIndex
CREATE INDEX "whatsapp_conversaciones_ultimo_mensaje_en_idx" ON "whatsapp_conversaciones"("ultimo_mensaje_en");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_conversaciones_organizacion_id_wa_id_key" ON "whatsapp_conversaciones"("organizacion_id", "wa_id");

-- CreateIndex
CREATE INDEX "whatsapp_mensajes_whatsapp_conversacion_id_fecha_mensaje_idx" ON "whatsapp_mensajes"("whatsapp_conversacion_id", "fecha_mensaje");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_mensajes_organizacion_id_wamid_key" ON "whatsapp_mensajes"("organizacion_id", "wamid");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_asignado_usuario_id_fkey" FOREIGN KEY ("asignado_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_asignado_por_usuario_id_fkey" FOREIGN KEY ("asignado_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conexiones" ADD CONSTRAINT "whatsapp_conexiones_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conexiones" ADD CONSTRAINT "whatsapp_conexiones_meta_conexion_id_fkey" FOREIGN KEY ("meta_conexion_id") REFERENCES "meta_conexiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversaciones" ADD CONSTRAINT "whatsapp_conversaciones_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversaciones" ADD CONSTRAINT "whatsapp_conversaciones_whatsapp_conexion_id_fkey" FOREIGN KEY ("whatsapp_conexion_id") REFERENCES "whatsapp_conexiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversaciones" ADD CONSTRAINT "whatsapp_conversaciones_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_mensajes" ADD CONSTRAINT "whatsapp_mensajes_whatsapp_conversacion_id_fkey" FOREIGN KEY ("whatsapp_conversacion_id") REFERENCES "whatsapp_conversaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Índices únicos parciales (mismo patrón que meta_paginas_page_id_unique):
-- un phone_number_id no puede estar vinculado a dos organizaciones a la vez,
-- y desvincular (estado=0) + re-vincular no debe chocar con el histórico.
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_conexiones_phone_number_id_activo_unique"
ON "whatsapp_conexiones" ("phone_number_id")
WHERE "estado" = 1;

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_conexiones_organizacion_phone_activo_unique"
ON "whatsapp_conexiones" ("organizacion_id", "phone_number_id")
WHERE "estado" = 1;
