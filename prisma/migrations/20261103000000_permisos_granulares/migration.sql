-- Permisos granulares por empresa (planificacion/permisos/PLAN-PERMISOS-GRANULARES.md §4).
-- Solo aditiva: no modifica ninguna membresía existente (rol_id queda NULL y se
-- resuelve por la columna rol hacia el rol de sistema equivalente).

CREATE TABLE "organizacion_roles" (
  "id" UUID NOT NULL,
  "organizacion_id" UUID NOT NULL,
  "codigo" VARCHAR(30),
  "nombre" VARCHAR(80) NOT NULL,
  "descripcion" VARCHAR(255),
  "es_sistema" SMALLINT NOT NULL DEFAULT 0,
  "permisos" VARCHAR(80)[] DEFAULT ARRAY[]::VARCHAR(80)[],
  "estado" SMALLINT NOT NULL DEFAULT 1,
  "usuario_creacion" UUID,
  "usuario_edicion" UUID,
  "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_modificacion" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "organizacion_roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organizacion_roles_organizacion_id_codigo_key"
  ON "organizacion_roles"("organizacion_id", "codigo");
CREATE INDEX "organizacion_roles_organizacion_id_estado_idx"
  ON "organizacion_roles"("organizacion_id", "estado");
ALTER TABLE "organizacion_roles" ADD CONSTRAINT "organizacion_roles_organizacion_id_fkey"
  FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "organizacion_rol_eventos" (
  "id" UUID NOT NULL,
  "organizacion_id" UUID NOT NULL,
  "rol_id" UUID NOT NULL,
  "actor_id" UUID NOT NULL,
  "accion" VARCHAR(40) NOT NULL,
  "nombre" VARCHAR(80) NOT NULL,
  "permisos_anteriores" VARCHAR(80)[] DEFAULT ARRAY[]::VARCHAR(80)[],
  "permisos_nuevos" VARCHAR(80)[] DEFAULT ARRAY[]::VARCHAR(80)[],
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organizacion_rol_eventos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "organizacion_rol_eventos_organizacion_id_creado_en_idx"
  ON "organizacion_rol_eventos"("organizacion_id", "creado_en");
ALTER TABLE "organizacion_rol_eventos" ADD CONSTRAINT "organizacion_rol_eventos_organizacion_id_fkey"
  FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "organizacion_rol_eventos" ADD CONSTRAINT "organizacion_rol_eventos_rol_id_fkey"
  FOREIGN KEY ("rol_id") REFERENCES "organizacion_roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE FUNCTION impedir_mutacion_evento_rol() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Los eventos de roles son inmutables';
END; $$;
CREATE TRIGGER organizacion_rol_eventos_inmutables
  BEFORE UPDATE OR DELETE OR TRUNCATE ON organizacion_rol_eventos
  FOR EACH STATEMENT EXECUTE FUNCTION impedir_mutacion_evento_rol();

ALTER TABLE "organizacion_usuarios" ADD COLUMN "rol_id" UUID;
CREATE INDEX "organizacion_usuarios_rol_id_idx" ON "organizacion_usuarios"("rol_id");
ALTER TABLE "organizacion_usuarios" ADD CONSTRAINT "organizacion_usuarios_rol_id_fkey"
  FOREIGN KEY ("rol_id") REFERENCES "organizacion_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Roles de sistema por empresa existente. Mismos permisos que ROLES_SISTEMA
-- en src/shared/domain/permisos.ts (reproducen los chequeos por rol anteriores).
INSERT INTO "organizacion_roles"
  ("id", "organizacion_id", "codigo", "nombre", "descripcion", "es_sistema", "permisos", "fecha_modificacion")
SELECT gen_random_uuid(), o."id", r.codigo, r.nombre, r.descripcion, 1, r.permisos, CURRENT_TIMESTAMP
FROM "organizaciones" o
CROSS JOIN (VALUES
  ('PROPIETARIO', 'Propietario', 'Dueño de la cuenta. Tiene todos los permisos.',
    ARRAY['empresa.configurar','usuarios.gestionar','roles.gestionar','dashboard.ver',
          'leads.ver','leads.ver_todos','leads.editar','leads.reclamar','leads.asignar','leads.configurar',
          'inmuebles.ver','inmuebles.crear','inmuebles.editar','inmuebles.eliminar',
          'meta.ver','meta.configurar',
          'chats.ver','chats.responder','chats.gestionar_todos','chats.plantillas','llamadas.usar','whatsapp.configurar',
          'bot.configurar']::VARCHAR(80)[]),
  ('ADMINISTRADOR', 'Administrador', 'Administra la empresa, el equipo y las integraciones.',
    ARRAY['empresa.configurar','usuarios.gestionar','roles.gestionar','dashboard.ver',
          'leads.ver','leads.ver_todos','leads.editar','leads.reclamar','leads.asignar','leads.configurar',
          'inmuebles.ver','inmuebles.crear','inmuebles.editar','inmuebles.eliminar',
          'meta.ver','meta.configurar',
          'chats.ver','chats.responder','chats.gestionar_todos','chats.plantillas','llamadas.usar','whatsapp.configurar',
          'bot.configurar']::VARCHAR(80)[]),
  ('USUARIO', 'Asesor', 'Atiende sus leads y chats y los que están sin asignar.',
    ARRAY['leads.ver','leads.editar','leads.reclamar','inmuebles.ver','meta.ver',
          'chats.ver','chats.responder','llamadas.usar']::VARCHAR(80)[])
) AS r(codigo, nombre, descripcion, permisos)
ON CONFLICT ("organizacion_id", "codigo") DO NOTHING;
