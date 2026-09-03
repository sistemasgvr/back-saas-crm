-- Recordatorios de agenda (idempotencia por ítem + offset) + suscripciones Web Push.

CREATE TABLE "agenda_recordatorios_enviados" (
    "id" UUID NOT NULL,
    "origen" VARCHAR(20) NOT NULL,
    "item_id" UUID NOT NULL,
    "offset_minutos" SMALLINT NOT NULL,
    "notificacion_id" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agenda_recordatorios_enviados_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agenda_recordatorios_enviados_origen_item_id_offset_minutos_key"
  ON "agenda_recordatorios_enviados"("origen", "item_id", "offset_minutos");

CREATE INDEX "agenda_recordatorios_enviados_item_id_idx"
  ON "agenda_recordatorios_enviados"("item_id");

CREATE TABLE "suscripciones_push" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" VARCHAR(255) NOT NULL,
    "auth" VARCHAR(255) NOT NULL,
    "user_agent" VARCHAR(255),
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "usuario_edicion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "suscripciones_push_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "suscripciones_push_endpoint_key" ON "suscripciones_push"("endpoint");
CREATE INDEX "suscripciones_push_usuario_id_idx" ON "suscripciones_push"("usuario_id");
CREATE INDEX "suscripciones_push_organizacion_id_idx" ON "suscripciones_push"("organizacion_id");
CREATE INDEX "suscripciones_push_estado_idx" ON "suscripciones_push"("estado");

ALTER TABLE "suscripciones_push"
  ADD CONSTRAINT "suscripciones_push_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "suscripciones_push"
  ADD CONSTRAINT "suscripciones_push_organizacion_id_fkey"
  FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
