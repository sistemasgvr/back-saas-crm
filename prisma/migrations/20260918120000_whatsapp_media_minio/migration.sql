-- MinIO: índice de objetos deduplicados + vínculo desde mensajes_media.
-- `bytes` pasa a nullable para coexistir durante el backfill; se droppea en migración 2.

CREATE TABLE "whatsapp_media_objetos" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "object_key" VARCHAR(512) NOT NULL,
    "tamano_bytes" INTEGER NOT NULL,
    "mime_type" VARCHAR(127) NOT NULL,
    "usos" INTEGER NOT NULL DEFAULT 0,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_media_objetos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_media_objetos_organizacion_id_sha256_key"
  ON "whatsapp_media_objetos"("organizacion_id", "sha256");

CREATE INDEX "whatsapp_media_objetos_organizacion_id_idx"
  ON "whatsapp_media_objetos"("organizacion_id");

ALTER TABLE "whatsapp_media_objetos"
  ADD CONSTRAINT "whatsapp_media_objetos_organizacion_id_fkey"
  FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "whatsapp_mensajes_media"
  ADD COLUMN "media_objeto_id" UUID;

ALTER TABLE "whatsapp_mensajes_media"
  ALTER COLUMN "bytes" DROP NOT NULL;

CREATE INDEX "whatsapp_mensajes_media_media_objeto_id_idx"
  ON "whatsapp_mensajes_media"("media_objeto_id");

ALTER TABLE "whatsapp_mensajes_media"
  ADD CONSTRAINT "whatsapp_mensajes_media_media_objeto_id_fkey"
  FOREIGN KEY ("media_objeto_id") REFERENCES "whatsapp_media_objetos"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
