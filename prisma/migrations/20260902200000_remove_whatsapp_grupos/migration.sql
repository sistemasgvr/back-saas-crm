-- Se saca la funcionalidad de grupos de WhatsApp por ahora (requiere status
-- OBA en el número, que la organización todavía no tiene) — se deja la
-- migración que las creó intacta (nunca se reescribe historial ya aplicado),
-- esto solo revierte las tablas hacia atrás.
DROP TABLE IF EXISTS "whatsapp_grupo_mensajes_media";
DROP TABLE IF EXISTS "whatsapp_grupo_mensajes";
DROP TABLE IF EXISTS "whatsapp_grupo_participantes";
DROP TABLE IF EXISTS "whatsapp_grupos";
