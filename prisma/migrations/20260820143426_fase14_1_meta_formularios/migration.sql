-- DropIndex
DROP INDEX "meta_cuentas_publicitarias_organizacion_id_idx";

-- AlterTable
ALTER TABLE "meta_paginas" ADD COLUMN     "webhook_ultimo_check_en" TIMESTAMPTZ,
ADD COLUMN     "webhook_ultimo_error" TEXT;

-- CreateTable
CREATE TABLE "meta_formularios" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "meta_pagina_id" UUID NOT NULL,
    "form_id" VARCHAR(64) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "estado_meta" VARCHAR(40),
    "locale" VARCHAR(20),
    "ultimo_sync_en" TIMESTAMPTZ,
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "usuario_edicion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "meta_formularios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meta_formularios_organizacion_id_form_id_idx" ON "meta_formularios"("organizacion_id", "form_id");

-- CreateIndex
CREATE INDEX "meta_formularios_meta_pagina_id_idx" ON "meta_formularios"("meta_pagina_id");

-- CreateIndex
CREATE INDEX "meta_formularios_estado_idx" ON "meta_formularios"("estado");

-- CreateIndex
CREATE INDEX "meta_cuentas_publicitarias_organizacion_id_ad_account_id_idx" ON "meta_cuentas_publicitarias"("organizacion_id", "ad_account_id");

-- AddForeignKey
ALTER TABLE "meta_formularios" ADD CONSTRAINT "meta_formularios_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_formularios" ADD CONSTRAINT "meta_formularios_meta_pagina_id_fkey" FOREIGN KEY ("meta_pagina_id") REFERENCES "meta_paginas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
