ALTER TABLE organizaciones ADD COLUMN limite_usuarios INTEGER NULL
  CHECK (limite_usuarios IS NULL OR limite_usuarios >= 1);
ALTER TABLE usuarios ADD COLUMN debe_cambiar_password SMALLINT NOT NULL DEFAULT 0;
CREATE TABLE organizacion_usuario_eventos (
  id UUID PRIMARY KEY,
  organizacion_id UUID NOT NULL REFERENCES organizaciones(id),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  actor_id UUID NOT NULL REFERENCES usuarios(id),
  accion VARCHAR(40) NOT NULL,
  rol_anterior VARCHAR(30), rol_nuevo VARCHAR(30),
  estado_anterior SMALLINT, estado_nuevo SMALLINT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX organizacion_usuario_eventos_organizacion_id_creado_en_idx
  ON organizacion_usuario_eventos(organizacion_id, creado_en);
CREATE FUNCTION impedir_mutacion_evento_membresia() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Los eventos de membresía son inmutables';
END; $$;
CREATE TRIGGER organizacion_usuario_eventos_inmutables
  BEFORE UPDATE OR DELETE OR TRUNCATE ON organizacion_usuario_eventos
  FOR EACH STATEMENT EXECUTE FUNCTION impedir_mutacion_evento_membresia();
