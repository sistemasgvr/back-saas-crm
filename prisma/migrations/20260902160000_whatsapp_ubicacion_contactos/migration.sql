-- AlterTable
ALTER TABLE "whatsapp_mensajes" ADD COLUMN     "contactos" JSONB,
ADD COLUMN     "ubicacion_direccion" VARCHAR(500),
ADD COLUMN     "ubicacion_latitud" DOUBLE PRECISION,
ADD COLUMN     "ubicacion_longitud" DOUBLE PRECISION,
ADD COLUMN     "ubicacion_nombre" VARCHAR(255);
