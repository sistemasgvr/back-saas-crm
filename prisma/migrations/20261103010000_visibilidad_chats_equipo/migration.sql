-- Conserva el acceso de los roles que ya gestionan los chats del equipo.
UPDATE "organizacion_roles"
SET "permisos" = array_append("permisos", 'chats.ver_todos')
WHERE 'chats.gestionar_todos' = ANY("permisos")
  AND NOT ('chats.ver_todos' = ANY("permisos"));
