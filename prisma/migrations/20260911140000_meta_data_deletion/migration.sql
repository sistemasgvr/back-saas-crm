-- Solicitudes de eliminación de datos Meta (Data Deletion Callback).
CREATE TABLE "meta_solicitudes_eliminacion_datos" (
    "id" UUID NOT NULL,
    "confirmation_code" VARCHAR(64) NOT NULL,
    "meta_user_id" VARCHAR(64) NOT NULL,
    "organizacion_id" UUID,
    "meta_conexion_id" UUID,
    "tipo" VARCHAR(32) NOT NULL DEFAULT 'DATA_DELETION',
    "estado" VARCHAR(32) NOT NULL DEFAULT 'PENDIENTE',
    "detalle" TEXT,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_procesada" TIMESTAMPTZ,

    CONSTRAINT "meta_solicitudes_eliminacion_datos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meta_solicitudes_eliminacion_datos_confirmation_code_key"
  ON "meta_solicitudes_eliminacion_datos"("confirmation_code");

CREATE INDEX "meta_solicitudes_eliminacion_datos_meta_user_id_idx"
  ON "meta_solicitudes_eliminacion_datos"("meta_user_id");

CREATE INDEX "meta_solicitudes_eliminacion_datos_estado_idx"
  ON "meta_solicitudes_eliminacion_datos"("estado");

ALTER TABLE "meta_solicitudes_eliminacion_datos"
  ADD CONSTRAINT "meta_solicitudes_eliminacion_datos_organizacion_id_fkey"
  FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "meta_solicitudes_eliminacion_datos"
  ADD CONSTRAINT "meta_solicitudes_eliminacion_datos_meta_conexion_id_fkey"
  FOREIGN KEY ("meta_conexion_id") REFERENCES "meta_conexiones"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
