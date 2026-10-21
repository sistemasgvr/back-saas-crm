CREATE TABLE IF NOT EXISTS "modulo_grupos" (
  "id" UUID NOT NULL, "codigo" VARCHAR(50) NOT NULL,
  "nombre" VARCHAR(120) NOT NULL, "descripcion" TEXT, "icono" VARCHAR(80),
  "orden" INTEGER NOT NULL DEFAULT 0, "estado" SMALLINT NOT NULL DEFAULT 1,
  "usuario_creacion" UUID, "usuario_edicion" UUID,
  "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_modificacion" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "modulo_grupos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "modulo_grupos_codigo_key" ON "modulo_grupos"("codigo");
ALTER TABLE "modulos" ADD COLUMN IF NOT EXISTS "grupo_id" UUID;
ALTER TABLE "modulos" ADD COLUMN IF NOT EXISTS "requiere" VARCHAR(50)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(50)[];
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='modulos_grupo_id_fkey') THEN
  ALTER TABLE "modulos" ADD CONSTRAINT "modulos_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "modulo_grupos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
 END IF;
END $$;
INSERT INTO modulo_grupos (id,codigo,nombre,icono,orden,fecha_modificacion) VALUES
 (gen_random_uuid(),'CRM','CRM','mdi:account-group-outline',1,CURRENT_TIMESTAMP), (gen_random_uuid(),'META','Meta','mdi:facebook',2,CURRENT_TIMESTAMP)
ON CONFLICT (codigo) DO NOTHING;
UPDATE modulos SET codigo='INMUEBLES', nombre='Inmuebles' WHERE codigo='CRM';
INSERT INTO modulos (id,codigo,nombre,icono,orden,fecha_modificacion)
VALUES (gen_random_uuid(),'LEADS','Leads','mdi:account-multiple-outline',2,CURRENT_TIMESTAMP)
ON CONFLICT (codigo) DO NOTHING;
INSERT INTO organizacion_modulos (id,organizacion_id,modulo_id,habilitado,estado,fecha_activacion,fecha_modificacion)
SELECT gen_random_uuid(),o.id,l.id,coalesce(om.habilitado,0),coalesce(om.estado,1),om.fecha_activacion,CURRENT_TIMESTAMP
FROM organizaciones o CROSS JOIN modulos l
LEFT JOIN modulos m ON m.codigo='META_LEADS'
LEFT JOIN organizacion_modulos om ON om.organizacion_id=o.id AND om.modulo_id=m.id
WHERE l.codigo='LEADS'
ON CONFLICT (organizacion_id,modulo_id) DO NOTHING;
UPDATE modulos m SET grupo_id=g.id, orden=v.orden, requiere=v.requiere
FROM (VALUES
 ('DASHBOARD','CRM',1,ARRAY[]::varchar(50)[]),
 ('LEADS','CRM',2,ARRAY[]::varchar(50)[]),
 ('INMUEBLES','CRM',3,ARRAY[]::varchar(50)[]),
 ('META_LEADS','META',1,ARRAY['LEADS']::varchar(50)[]),
 ('WHATSAPP','META',2,ARRAY['LEADS']::varchar(50)[]),
 ('AUTOMATIZACIONES','META',3,ARRAY['WHATSAPP']::varchar(50)[])
) v(codigo,grupo,orden,requiere), modulo_grupos g
WHERE m.codigo=v.codigo AND g.codigo=v.grupo;
ALTER TABLE modulo_grupos ALTER COLUMN id DROP DEFAULT;
ALTER TABLE modulo_grupos ALTER COLUMN fecha_modificacion DROP DEFAULT;
