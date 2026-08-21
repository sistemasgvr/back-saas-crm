-- G2: asignación de leads (tomar / asignar) + tipo de lead opcional.
-- PLAN-GESTION-LEADS-WHATSAPP.md §4.2.
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "tipo_lead" VARCHAR(40);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "asignado_usuario_id" UUID;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "asignado_en" TIMESTAMPTZ;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "asignado_por_usuario_id" UUID;

DO $$ BEGIN
  ALTER TABLE "leads" ADD CONSTRAINT "leads_asignado_usuario_id_fkey"
    FOREIGN KEY ("asignado_usuario_id") REFERENCES "usuarios"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "leads" ADD CONSTRAINT "leads_asignado_por_usuario_id_fkey"
    FOREIGN KEY ("asignado_por_usuario_id") REFERENCES "usuarios"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "leads_asignado_usuario_id_idx" ON "leads"("asignado_usuario_id");
CREATE INDEX IF NOT EXISTS "leads_tipo_lead_idx" ON "leads"("tipo_lead");
