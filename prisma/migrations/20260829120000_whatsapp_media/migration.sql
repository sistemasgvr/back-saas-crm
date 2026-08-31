-- AlterTable
ALTER TABLE "whatsapp_mensajes" ADD COLUMN     "media_caption" TEXT,
ADD COLUMN     "media_es_voz" BOOLEAN,
ADD COLUMN     "media_id" VARCHAR(128),
ADD COLUMN     "media_mime_type" VARCHAR(100),
ADD COLUMN     "media_nombre_archivo" TEXT,
ADD COLUMN     "media_tamano_bytes" INTEGER;

-- CreateTable
CREATE TABLE "whatsapp_mensajes_media" (
    "whatsapp_mensaje_id" UUID NOT NULL,
    "bytes" BYTEA NOT NULL,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_mensajes_media_pkey" PRIMARY KEY ("whatsapp_mensaje_id")
);

-- AddForeignKey
ALTER TABLE "whatsapp_mensajes_media" ADD CONSTRAINT "whatsapp_mensajes_media_whatsapp_mensaje_id_fkey" FOREIGN KEY ("whatsapp_mensaje_id") REFERENCES "whatsapp_mensajes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

