-- WhatsApp Cloud API Calling: roles de línea + historial de llamadas

ALTER TABLE "whatsapp_conexiones"
  ADD COLUMN IF NOT EXISTS "rol_linea" VARCHAR(20) NOT NULL DEFAULT 'MENSAJES',
  ADD COLUMN IF NOT EXISTS "calling_habilitado" SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "calling_ultimo_error" TEXT;

CREATE INDEX IF NOT EXISTS "whatsapp_conexiones_organizacion_id_rol_linea_idx"
  ON "whatsapp_conexiones"("organizacion_id", "rol_linea");

CREATE TABLE IF NOT EXISTS "whatsapp_llamadas" (
  "id" UUID NOT NULL,
  "organizacion_id" UUID NOT NULL,
  "whatsapp_conexion_id" UUID NOT NULL,
  "conversacion_id" UUID,
  "lead_id" UUID,
  "asignado_usuario_id" UUID,
  "call_id" VARCHAR(128) NOT NULL,
  "wa_id" VARCHAR(40),
  "direccion" VARCHAR(12) NOT NULL,
  "estado" VARCHAR(20) NOT NULL,
  "resultado" VARCHAR(20),
  "inicio_en" TIMESTAMPTZ NOT NULL,
  "contestada_en" TIMESTAMPTZ,
  "fin_en" TIMESTAMPTZ,
  "duracion_seg" INTEGER,
  "nota_post_llamada" TEXT,
  "motivo" VARCHAR(40),
  "error_codigo" VARCHAR(40),
  "error_mensaje" TEXT,
  "datos_crudos" JSONB,
  "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_modificacion" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "whatsapp_llamadas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_llamadas_organizacion_id_call_id_key"
  ON "whatsapp_llamadas"("organizacion_id", "call_id");

CREATE INDEX IF NOT EXISTS "whatsapp_llamadas_organizacion_id_inicio_en_idx"
  ON "whatsapp_llamadas"("organizacion_id", "inicio_en" DESC);

CREATE INDEX IF NOT EXISTS "whatsapp_llamadas_conversacion_id_idx"
  ON "whatsapp_llamadas"("conversacion_id");

CREATE INDEX IF NOT EXISTS "whatsapp_llamadas_lead_id_idx"
  ON "whatsapp_llamadas"("lead_id");

CREATE INDEX IF NOT EXISTS "whatsapp_llamadas_asignado_usuario_id_inicio_en_idx"
  ON "whatsapp_llamadas"("asignado_usuario_id", "inicio_en");

ALTER TABLE "whatsapp_llamadas"
  ADD CONSTRAINT "whatsapp_llamadas_organizacion_id_fkey"
  FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "whatsapp_llamadas"
  ADD CONSTRAINT "whatsapp_llamadas_whatsapp_conexion_id_fkey"
  FOREIGN KEY ("whatsapp_conexion_id") REFERENCES "whatsapp_conexiones"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "whatsapp_llamadas"
  ADD CONSTRAINT "whatsapp_llamadas_conversacion_id_fkey"
  FOREIGN KEY ("conversacion_id") REFERENCES "whatsapp_conversaciones"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "whatsapp_llamadas"
  ADD CONSTRAINT "whatsapp_llamadas_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "leads"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "whatsapp_llamadas"
  ADD CONSTRAINT "whatsapp_llamadas_asignado_usuario_id_fkey"
  FOREIGN KEY ("asignado_usuario_id") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
