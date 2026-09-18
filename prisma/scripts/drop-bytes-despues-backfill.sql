-- Ejecutar SOLO después del backfill a MinIO:
--   npx ts-node prisma/scripts/migrar-media-minio.ts
-- Luego:
--   psql "$DATABASE_URL" -f prisma/scripts/drop-bytes-despues-backfill.sql
--   VACUUM FULL whatsapp_mensajes_media;  -- en EasyPanel para devolver disco
--
-- Después actualiza schema.prisma: quita `bytes` y marca mediaObjetoId como requerido.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "whatsapp_mensajes_media"
    WHERE "media_objeto_id" IS NULL AND "bytes" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Hay filas whatsapp_mensajes_media sin migrar a MinIO. Corre prisma/scripts/migrar-media-minio.ts antes.';
  END IF;
END $$;

DELETE FROM "whatsapp_mensajes_media"
WHERE "media_objeto_id" IS NULL;

ALTER TABLE "whatsapp_mensajes_media"
  ALTER COLUMN "media_objeto_id" SET NOT NULL;

ALTER TABLE "whatsapp_mensajes_media"
  DROP COLUMN IF EXISTS "bytes";
