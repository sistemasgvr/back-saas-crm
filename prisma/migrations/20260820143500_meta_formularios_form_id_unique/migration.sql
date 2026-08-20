-- (organizacion_id, form_id) único solo entre formularios activos — permite
-- re-sincronizar/re-vincular sin chocar con filas soft-deleted (PLAN-FASE-14 §3.1).
CREATE UNIQUE INDEX IF NOT EXISTS "meta_formularios_organizacion_form_id_activo_unique"
ON "meta_formularios" ("organizacion_id", "form_id")
WHERE "estado" = 1;
