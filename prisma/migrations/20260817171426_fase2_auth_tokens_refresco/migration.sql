-- CreateTable
CREATE TABLE "tokens_refresco" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expira_en" TIMESTAMPTZ NOT NULL,
    "revocado_en" TIMESTAMPTZ,
    "ip" VARCHAR(64),
    "user_agent" TEXT,
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "usuario_edicion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tokens_refresco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tokens_refresco_usuario_id_idx" ON "tokens_refresco"("usuario_id");

-- CreateIndex
CREATE INDEX "tokens_refresco_token_hash_idx" ON "tokens_refresco"("token_hash");

-- CreateIndex
CREATE INDEX "tokens_refresco_expira_en_idx" ON "tokens_refresco"("expira_en");

-- CreateIndex
CREATE INDEX "tokens_refresco_estado_idx" ON "tokens_refresco"("estado");

-- AddForeignKey
ALTER TABLE "tokens_refresco" ADD CONSTRAINT "tokens_refresco_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
