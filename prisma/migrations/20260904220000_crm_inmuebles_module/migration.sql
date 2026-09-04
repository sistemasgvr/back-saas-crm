-- CRM deja de ser placeholder: producto = catálogo de inmuebles.
UPDATE "modulos"
SET
  "nombre" = 'CRM',
  "descripcion" = 'Catálogo de inmuebles (propiedades de la organización)',
  "fecha_modificacion" = CURRENT_TIMESTAMP
WHERE "codigo" = 'CRM';

-- Backfill: orgs con META_LEADS activo también habilitan CRM (no romper inventario existente).
UPDATE "organizacion_modulos" AS om
SET
  "habilitado" = 1,
  "fecha_activacion" = COALESCE(om."fecha_activacion", CURRENT_TIMESTAMP),
  "fecha_modificacion" = CURRENT_TIMESTAMP
FROM "modulos" AS m_crm
WHERE om."modulo_id" = m_crm."id"
  AND m_crm."codigo" = 'CRM'
  AND om."habilitado" = 0
  AND EXISTS (
    SELECT 1
    FROM "organizacion_modulos" AS om_ml
    INNER JOIN "modulos" AS m_ml ON m_ml."id" = om_ml."modulo_id"
    WHERE om_ml."organizacion_id" = om."organizacion_id"
      AND m_ml."codigo" = 'META_LEADS'
      AND om_ml."habilitado" = 1
  );
