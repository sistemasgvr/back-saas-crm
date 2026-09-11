-- Reset operativo: todos los leads activos vuelven a etapa NUEVO
-- (limpia cierres; el tipoLead se conserva para no perder clasificación).
UPDATE "leads"
SET
  "estado_gestion" = 'NUEVO',
  "estado_gestion_en" = NOW(),
  "estado_gestion_por_usuario_id" = NULL,
  "motivo_cierre" = NULL,
  "nota_cierre" = NULL,
  "fecha_modificacion" = NOW()
WHERE "estado" = 1
  AND "estado_gestion" <> 'NUEVO';
