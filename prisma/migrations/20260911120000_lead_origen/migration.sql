-- Origen del lead para distinguir Meta / WhatsApp / manual.
ALTER TABLE "leads" ADD COLUMN "origen" VARCHAR(20);

UPDATE "leads"
SET "origen" = 'WHATSAPP'
WHERE "id_externo" LIKE 'wa:%'
   OR ("datos_crudos"->>'origen') = 'whatsapp_chat';

UPDATE "leads"
SET "origen" = 'META'
WHERE "origen" IS NULL
  AND ("meta_pagina_id" IS NOT NULL OR "formulario_id" IS NOT NULL);

UPDATE "leads"
SET "origen" = 'MANUAL'
WHERE "origen" IS NULL;

ALTER TABLE "leads" ALTER COLUMN "origen" SET NOT NULL;
ALTER TABLE "leads" ALTER COLUMN "origen" SET DEFAULT 'MANUAL';

CREATE INDEX "leads_origen_idx" ON "leads"("origen");
