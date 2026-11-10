-- Nuevo permiso granular empresa.exportar. Antes la exportación era solo de
-- Propietario/Administrador por rol: se conserva ese acceso agregándolo a los
-- roles de sistema guardados. Los roles personalizados no lo reciben.
UPDATE "organizacion_roles"
SET "permisos" = array_append("permisos", 'empresa.exportar')
WHERE "es_sistema" = 1
  AND "codigo" IN ('PROPIETARIO', 'ADMINISTRADOR')
  AND NOT ('empresa.exportar' = ANY("permisos"));
