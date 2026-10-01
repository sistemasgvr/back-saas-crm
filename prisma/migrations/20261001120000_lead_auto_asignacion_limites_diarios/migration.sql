ALTER TABLE "lead_auto_asignacion_config"
ADD COLUMN "limites_diarios" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "consumo_diario" JSONB NOT NULL DEFAULT '{}';
