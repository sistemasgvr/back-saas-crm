-- CreateTable
CREATE TABLE "meta_conexiones" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "meta_user_id" VARCHAR(64) NOT NULL,
    "meta_user_nombre" VARCHAR(200),
    "ad_account_id" VARCHAR(64),
    "ad_account_nombre" VARCHAR(200),
    "page_id" VARCHAR(64),
    "page_nombre" VARCHAR(200),
    "token_cifrado" TEXT NOT NULL,
    "token_expira_en" TIMESTAMPTZ,
    "scopes" TEXT,
    "webhook_verify_token" VARCHAR(128) NOT NULL,
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "usuario_edicion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "meta_conexiones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meta_conexiones_organizacion_id_idx" ON "meta_conexiones"("organizacion_id");

-- CreateIndex
CREATE INDEX "meta_conexiones_page_id_idx" ON "meta_conexiones"("page_id");

-- CreateIndex
CREATE INDEX "meta_conexiones_ad_account_id_idx" ON "meta_conexiones"("ad_account_id");

-- CreateIndex
CREATE INDEX "meta_conexiones_estado_idx" ON "meta_conexiones"("estado");

-- AddForeignKey
ALTER TABLE "meta_conexiones" ADD CONSTRAINT "meta_conexiones_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
