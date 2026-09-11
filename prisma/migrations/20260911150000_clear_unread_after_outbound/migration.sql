-- Chats ya respondidos (último mensaje saliente) no deben seguir con badge de no leídos.
UPDATE "whatsapp_conversaciones" AS c
SET "no_leidos" = 0
FROM (
  SELECT DISTINCT ON ("whatsapp_conversacion_id")
    "whatsapp_conversacion_id",
    "direccion"
  FROM "whatsapp_mensajes"
  ORDER BY "whatsapp_conversacion_id", "fecha_mensaje" DESC
) AS ult
WHERE ult."whatsapp_conversacion_id" = c."id"
  AND ult."direccion" = 'saliente'
  AND c."no_leidos" > 0;
