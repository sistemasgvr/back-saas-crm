-- Preferencias de features Meta que la org quiere solicitar en OAuth, más allá
-- de las núcleo (siempre incluidas) — PLAN.md Fase 16.
ALTER TABLE "meta_conexiones" ADD COLUMN IF NOT EXISTS "features_deseadas" JSONB;
