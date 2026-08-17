-- Índice único parcial: page_id único entre conexiones activas (PLAN.md §8.3, §15 P1).
CREATE UNIQUE INDEX IF NOT EXISTS "meta_conexiones_page_id_activo_unique"
ON "meta_conexiones" ("page_id")
WHERE "estado" = 1 AND "page_id" IS NOT NULL;
