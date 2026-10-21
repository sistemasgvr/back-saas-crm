BEGIN;
ALTER TABLE whatsapp_bot_configuraciones
 ADD COLUMN modo_inicial VARCHAR(10) NOT NULL DEFAULT 'HUMANO' CHECK (modo_inicial IN ('HUMANO','BOT')),
 ADD COLUMN preferencias_version INTEGER NOT NULL DEFAULT 0 CHECK (preferencias_version >= 0),
 ADD COLUMN preferencias_actualizado_por UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
 ADD COLUMN preferencias_actualizado_en TIMESTAMPTZ;
CREATE TABLE whatsapp_bot_preferencia_eventos (
 id UUID PRIMARY KEY,
 organizacion_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
 usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
 version INTEGER NOT NULL CHECK (version > 0),
 modo_anterior VARCHAR(10) NOT NULL CHECK (modo_anterior IN ('HUMANO','BOT')),
 modo_nuevo VARCHAR(10) NOT NULL CHECK (modo_nuevo IN ('HUMANO','BOT')),
 creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT whatsapp_bot_preferencia_eventos_organizacion_id_version_key UNIQUE (organizacion_id,version),
 CONSTRAINT wa_bot_preferencia_cambio_check CHECK (modo_anterior <> modo_nuevo)
);
CREATE TRIGGER whatsapp_bot_preferencias_inmutable BEFORE UPDATE OR DELETE ON whatsapp_bot_preferencia_eventos
 FOR EACH ROW EXECUTE FUNCTION proteger_historial_bot_configuracion();
COMMIT;
