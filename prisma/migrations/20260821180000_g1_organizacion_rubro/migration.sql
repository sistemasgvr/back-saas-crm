-- G1: rubro de la organización — único valor operativo hoy: INMOBILIARIA.
-- PLAN-GESTION-LEADS-WHATSAPP.md §3/§4.1.
ALTER TABLE "organizaciones" ADD COLUMN IF NOT EXISTS "rubro" VARCHAR(40) NOT NULL DEFAULT 'INMOBILIARIA';

CREATE INDEX IF NOT EXISTS "organizaciones_rubro_idx" ON "organizaciones"("rubro");
