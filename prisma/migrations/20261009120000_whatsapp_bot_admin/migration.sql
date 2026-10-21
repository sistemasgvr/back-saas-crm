-- Preparada únicamente: no aplicar hasta autorizar las migraciones del piloto.
BEGIN;
ALTER TABLE whatsapp_bot_configuraciones
 ADD COLUMN version INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN actualizado_por UUID,
 ADD COLUMN actualizado_en TIMESTAMPTZ,
 ADD CONSTRAINT wa_bot_config_version_check CHECK (version >= 0),
 ADD CONSTRAINT wa_bot_config_admin_fkey FOREIGN KEY (actualizado_por) REFERENCES usuarios(id) ON DELETE RESTRICT;

CREATE TABLE whatsapp_bot_configuracion_eventos (
 id UUID PRIMARY KEY,
 organizacion_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
 usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
 version INTEGER NOT NULL CHECK (version > 0),
 habilitado_anterior BOOLEAN NOT NULL,
 habilitado_nuevo BOOLEAN NOT NULL,
 motivo VARCHAR(500) NOT NULL CHECK (length(trim(motivo)) >= 8),
 creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT whatsapp_bot_configuracion_eventos_organizacion_id_version_key UNIQUE (organizacion_id, version),
 CONSTRAINT wa_bot_config_cambio_check CHECK (habilitado_anterior <> habilitado_nuevo)
);
CREATE FUNCTION proteger_historial_bot_configuracion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'El historial de configuración del bot es inmutable';
END;
$$;
CREATE TRIGGER whatsapp_bot_configuracion_inmutable BEFORE UPDATE OR DELETE ON whatsapp_bot_configuracion_eventos
 FOR EACH ROW EXECUTE FUNCTION proteger_historial_bot_configuracion();
COMMIT;
