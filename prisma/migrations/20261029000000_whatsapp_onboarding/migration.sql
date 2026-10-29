CREATE TABLE "whatsapp_onboarding" (
 "id" UUID NOT NULL, "organizacion_id" UUID NOT NULL, "usuario_id" UUID NOT NULL,
 "meta_conexion_id" UUID NOT NULL, "app_id" TEXT NOT NULL, "token_cifrado" TEXT NOT NULL,
 "expira_en" TIMESTAMPTZ NOT NULL, "estado" TEXT NOT NULL DEFAULT 'TOKEN',
 "waba_id" TEXT, "phone_number_id" TEXT, "contactos_request_id" TEXT,
 "historial_request_id" TEXT, "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "whatsapp_onboarding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "whatsapp_onboarding_organizacion_id_usuario_id_idx" ON "whatsapp_onboarding"("organizacion_id", "usuario_id");
