-- Leads vinculados a un chat WA sin nombre propio: copiar nombre_contacto
-- (el chat ya lo tenía; al vincular por teléfono no se propagaba).
UPDATE leads l
SET nombre = wc.nombre_contacto
FROM whatsapp_conversaciones wc
WHERE wc.lead_id = l.id
  AND wc.estado = 1
  AND l.estado = 1
  AND (l.nombre IS NULL OR btrim(l.nombre) = '')
  AND wc.nombre_contacto IS NOT NULL
  AND btrim(wc.nombre_contacto) <> '';
