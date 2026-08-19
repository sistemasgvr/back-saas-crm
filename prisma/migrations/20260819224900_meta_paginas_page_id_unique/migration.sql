-- La migración anterior generó un unique NO parcial para (organizacion_id, ad_account_id)
-- porque el @@unique original en schema.prisma no distinguía por estado. Se reemplaza acá
-- por el parcial de abajo (tabla recién creada, sin datos — drop seguro).
DROP INDEX IF EXISTS "meta_cuentas_publicitarias_organizacion_id_ad_account_id_key";

-- Índices únicos parciales (PLAN-FASE-13-META-MULTI.md §3.1):
--   1) page_id único entre TODAS las páginas activas (misma regla MVP que meta_conexiones:
--      una página de Facebook no puede estar vinculada a dos organizaciones a la vez).
--   2) page_id único dentro de la propia organización (evita duplicar la vinculación).
CREATE UNIQUE INDEX IF NOT EXISTS "meta_paginas_page_id_activo_unique"
ON "meta_paginas" ("page_id")
WHERE "estado" = 1;

CREATE UNIQUE INDEX IF NOT EXISTS "meta_paginas_organizacion_page_id_activo_unique"
ON "meta_paginas" ("organizacion_id", "page_id")
WHERE "estado" = 1;

-- (organizacion_id, ad_account_id) único solo entre cuentas activas — misma razón:
-- desvincular (estado=0) y volver a vincular la misma cuenta no debe chocar.
CREATE UNIQUE INDEX IF NOT EXISTS "meta_cuentas_publicitarias_organizacion_ad_account_activo_unique"
ON "meta_cuentas_publicitarias" ("organizacion_id", "ad_account_id")
WHERE "estado" = 1;
