BEGIN;

-- Backfill seguro: todos los chats existentes permanecen MANUAL, sin eventos ni activación del bot.
-- DropIndex
DROP INDEX "whatsapp_conversaciones_organizacion_id_wa_id_key";

-- AlterTable
ALTER TABLE "whatsapp_conversaciones" ADD COLUMN     "control_motivo" VARCHAR(100),
ADD COLUMN     "control_solicitado_en" TIMESTAMPTZ,
ADD COLUMN     "control_tomado_en" TIMESTAMPTZ,
ADD COLUMN     "control_usuario_id" UUID,
ADD COLUMN     "control_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "entrada_revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fase_precalificacion" VARCHAR(30) NOT NULL DEFAULT 'NO_INICIADA',
ADD COLUMN     "modo_atencion" VARCHAR(20) NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "whatsapp_mensajes" ADD COLUMN     "autor_tipo" VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN';

-- CreateTable
CREATE TABLE "whatsapp_bot_configuraciones" (
    "organizacion_id" UUID NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "whatsapp_bot_configuraciones_pkey" PRIMARY KEY ("organizacion_id")
);

-- CreateTable
CREATE TABLE "whatsapp_control_eventos" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "conversacion_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "wamid" VARCHAR(128),
    "modo" VARCHAR(20) NOT NULL,
    "motivo" VARCHAR(100) NOT NULL,
    "actor" VARCHAR(20) NOT NULL,
    "usuario_id" UUID,
    "responsable_id" UUID,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_control_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_salida_intentos" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "conversacion_id" UUID NOT NULL,
    "actor" VARCHAR(20) NOT NULL,
    "usuario_id" UUID,
    "clave" VARCHAR(200) NOT NULL,
    "tipo" VARCHAR(80) NOT NULL,
    "control_version" INTEGER NOT NULL,
    "estado" VARCHAR(20) NOT NULL,
    "wamid" VARCHAR(128),
    "mensaje_persistido" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminado_en" TIMESTAMPTZ,

    CONSTRAINT "whatsapp_salida_intentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_control_eventos_organizacion_id_conversacion_id_ve_key" ON "whatsapp_control_eventos"("organizacion_id", "conversacion_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_control_eventos_organizacion_id_wamid_key" ON "whatsapp_control_eventos" ("organizacion_id", "wamid");

-- CreateIndex
CREATE INDEX "whatsapp_salida_intentos_organizacion_id_conversacion_id_es_idx" ON "whatsapp_salida_intentos"("organizacion_id", "conversacion_id", "estado");

-- CreateIndex
CREATE INDEX "whatsapp_salida_intentos_organizacion_id_wamid_idx" ON "whatsapp_salida_intentos"("organizacion_id", "wamid");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_salida_intentos_organizacion_id_clave_key" ON "whatsapp_salida_intentos"("organizacion_id", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_conversaciones_org_linea_wa_key" ON "whatsapp_conversaciones"("organizacion_id", "whatsapp_conexion_id", "wa_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_conversaciones_org_linea_bsuid_key" ON "whatsapp_conversaciones"("organizacion_id", "whatsapp_conexion_id", "bsuid");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_conversaciones_organizacion_id_id_key" ON "whatsapp_conversaciones"("organizacion_id", "id");

-- AddForeignKey
ALTER TABLE "whatsapp_control_eventos" ADD CONSTRAINT "whatsapp_control_eventos_organizacion_id_conversacion_id_fkey" FOREIGN KEY ("organizacion_id", "conversacion_id") REFERENCES "whatsapp_conversaciones"("organizacion_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_salida_intentos" ADD CONSTRAINT "whatsapp_salida_intentos_organizacion_id_conversacion_id_fkey" FOREIGN KEY ("organizacion_id", "conversacion_id") REFERENCES "whatsapp_conversaciones"("organizacion_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sustituye la unicidad parcial anterior: un contacto puede usar varias líneas.
DROP INDEX IF EXISTS "whatsapp_conversaciones_org_bsuid_key";

ALTER TABLE "whatsapp_conversaciones"
 ADD CONSTRAINT "wa_control_modo_check" CHECK (modo_atencion IN ('MANUAL','BOT_ACTIVO','ESPERANDO_HUMANO','HUMANO_ACTIVO','TOMANDO_CONTROL','PAUSADO','CERRADO')),
 ADD CONSTRAINT "wa_control_version_check" CHECK (control_version >= 0 AND entrada_revision >= 0),
 ADD CONSTRAINT "wa_control_responsable_fkey" FOREIGN KEY (organizacion_id, control_usuario_id)
 REFERENCES organizacion_usuarios (organizacion_id, usuario_id) ON DELETE RESTRICT;
ALTER TABLE "whatsapp_bot_configuraciones" ADD CONSTRAINT "wa_bot_org_fkey"
 FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE RESTRICT;
ALTER TABLE "whatsapp_control_eventos"
 ADD CONSTRAINT "wa_evento_actor_fkey" FOREIGN KEY (organizacion_id, usuario_id)
 REFERENCES organizacion_usuarios (organizacion_id, usuario_id) ON DELETE RESTRICT,
 ADD CONSTRAINT "wa_evento_responsable_fkey" FOREIGN KEY (organizacion_id, responsable_id)
 REFERENCES organizacion_usuarios (organizacion_id, usuario_id) ON DELETE RESTRICT;
ALTER TABLE "whatsapp_salida_intentos"
 ADD CONSTRAINT "wa_intento_usuario_fkey" FOREIGN KEY (organizacion_id, usuario_id)
 REFERENCES organizacion_usuarios (organizacion_id, usuario_id) ON DELETE RESTRICT,
 ADD CONSTRAINT "wa_intento_actor_check" CHECK (actor IN ('HUMAN','BOT','SYSTEM')),
 ADD CONSTRAINT "wa_intento_estado_check" CHECK (estado IN ('DESPACHANDO','ACEPTADO','INCIERTO'));
ALTER TABLE "whatsapp_mensajes" ADD CONSTRAINT "wa_mensaje_autor_check"
 CHECK (autor_tipo IN ('UNKNOWN','CUSTOMER','HUMAN','BOT','SYSTEM','EXTERNAL'));

-- Backfill de autoría en lotes de 500; no cambia contenido, fechas ni contadores.
-- Los salientes sin evidencia permanecen UNKNOWN.
DO $$
DECLARE filas integer;
BEGIN
 LOOP
  WITH lote AS (
    SELECT id FROM whatsapp_mensajes
    WHERE autor_tipo = 'UNKNOWN' AND (
      direccion = 'entrante' OR
      (direccion = 'saliente' AND (usuario_creacion IS NOT NULL OR datos_crudos->>'origen' = 'agenda_recordatorio'))
    ) ORDER BY id LIMIT 500
  )
  UPDATE whatsapp_mensajes m SET autor_tipo = CASE
    WHEN direccion = 'entrante' THEN 'CUSTOMER'
    WHEN usuario_creacion IS NOT NULL THEN 'HUMAN'
    ELSE 'SYSTEM' END
  FROM lote WHERE m.id = lote.id;
  GET DIAGNOSTICS filas = ROW_COUNT;
  EXIT WHEN filas = 0;
 END LOOP;
END;
$$;

CREATE FUNCTION proteger_historial_control_whatsapp() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'El historial de control de WhatsApp es inmutable';
END;
$$;
CREATE TRIGGER whatsapp_control_inmutable BEFORE UPDATE OR DELETE ON whatsapp_control_eventos
 FOR EACH ROW EXECUTE FUNCTION proteger_historial_control_whatsapp();

COMMIT;
