-- Fase 21: metadata estructurada por transición de pipeline (visita, calificación, etc.)
ALTER TABLE "lead_estado_historial"
ADD COLUMN "metadata" JSONB;
