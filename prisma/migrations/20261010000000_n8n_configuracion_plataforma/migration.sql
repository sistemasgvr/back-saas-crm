BEGIN;
CREATE TABLE automatizacion_integraciones (
 id VARCHAR(20) PRIMARY KEY CHECK (id = 'n8n'),
 webhook_url VARCHAR(2048) NOT NULL,
 header_nombre VARCHAR(100) NOT NULL DEFAULT 'X-CRM-Secret',
 secreto_cifrado TEXT,
 version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
 actualizado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
 actualizado_en TIMESTAMPTZ NOT NULL
);
CREATE TABLE automatizacion_integracion_eventos (
 id UUID PRIMARY KEY,
 version INTEGER NOT NULL UNIQUE CHECK (version > 0),
 usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
 secreto_accion VARCHAR(20) NOT NULL CHECK (secreto_accion IN ('CONSERVADO','REEMPLAZADO','ELIMINADO')),
 creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER automatizacion_integracion_inmutable BEFORE UPDATE OR DELETE ON automatizacion_integracion_eventos
 FOR EACH ROW EXECUTE FUNCTION proteger_historial_bot_configuracion();
COMMIT;
