-- Un solo snapshot activo por día a nivel cuenta (campana_id NULL) y uno por
-- día por campaña (campana_id no NULL) — dos índices porque NULL rompe la
-- semántica de un único índice único normal (PLAN.md Fase 15 / meta_insights_diarios).
CREATE UNIQUE INDEX IF NOT EXISTS "meta_insights_cuenta_fecha_activo_unique"
ON "meta_insights_diarios" ("organizacion_id", "meta_cuenta_publicitaria_id", "fecha")
WHERE "campana_id" IS NULL AND "estado" = 1;

CREATE UNIQUE INDEX IF NOT EXISTS "meta_insights_campana_fecha_activo_unique"
ON "meta_insights_diarios" ("organizacion_id", "meta_cuenta_publicitaria_id", "campana_id", "fecha")
WHERE "campana_id" IS NOT NULL AND "estado" = 1;
