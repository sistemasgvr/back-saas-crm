-- AlterTable
ALTER TABLE "campanas" ADD COLUMN     "meta_cuenta_publicitaria_id" UUID;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "meta_pagina_id" UUID;

-- CreateTable
CREATE TABLE "meta_paginas" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "meta_conexion_id" UUID NOT NULL,
    "page_id" VARCHAR(64) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "token_pagina_cifrado" TEXT,
    "webhook_suscrito" SMALLINT NOT NULL DEFAULT 0,
    "webhook_suscrito_en" TIMESTAMPTZ,
    "foto_url" TEXT,
    "categoria" VARCHAR(120),
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "usuario_edicion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "meta_paginas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_cuentas_publicitarias" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "meta_conexion_id" UUID NOT NULL,
    "ad_account_id" VARCHAR(64) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "moneda" VARCHAR(8),
    "estado_cuenta" VARCHAR(40),
    "timezone" VARCHAR(64),
    "ultimo_sync_en" TIMESTAMPTZ,
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "usuario_edicion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "meta_cuentas_publicitarias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meta_paginas_organizacion_id_idx" ON "meta_paginas"("organizacion_id");

-- CreateIndex
CREATE INDEX "meta_paginas_meta_conexion_id_idx" ON "meta_paginas"("meta_conexion_id");

-- CreateIndex
CREATE INDEX "meta_paginas_page_id_idx" ON "meta_paginas"("page_id");

-- CreateIndex
CREATE INDEX "meta_paginas_estado_idx" ON "meta_paginas"("estado");

-- CreateIndex
CREATE INDEX "meta_cuentas_publicitarias_organizacion_id_idx" ON "meta_cuentas_publicitarias"("organizacion_id");

-- CreateIndex
CREATE INDEX "meta_cuentas_publicitarias_meta_conexion_id_idx" ON "meta_cuentas_publicitarias"("meta_conexion_id");

-- CreateIndex
CREATE INDEX "meta_cuentas_publicitarias_estado_idx" ON "meta_cuentas_publicitarias"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "meta_cuentas_publicitarias_organizacion_id_ad_account_id_key" ON "meta_cuentas_publicitarias"("organizacion_id", "ad_account_id");

-- CreateIndex
CREATE INDEX "campanas_meta_cuenta_publicitaria_id_idx" ON "campanas"("meta_cuenta_publicitaria_id");

-- CreateIndex
CREATE INDEX "leads_meta_pagina_id_idx" ON "leads"("meta_pagina_id");

-- AddForeignKey
ALTER TABLE "campanas" ADD CONSTRAINT "campanas_meta_cuenta_publicitaria_id_fkey" FOREIGN KEY ("meta_cuenta_publicitaria_id") REFERENCES "meta_cuentas_publicitarias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_meta_pagina_id_fkey" FOREIGN KEY ("meta_pagina_id") REFERENCES "meta_paginas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_paginas" ADD CONSTRAINT "meta_paginas_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_paginas" ADD CONSTRAINT "meta_paginas_meta_conexion_id_fkey" FOREIGN KEY ("meta_conexion_id") REFERENCES "meta_conexiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_cuentas_publicitarias" ADD CONSTRAINT "meta_cuentas_publicitarias_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_cuentas_publicitarias" ADD CONSTRAINT "meta_cuentas_publicitarias_meta_conexion_id_fkey" FOREIGN KEY ("meta_conexion_id") REFERENCES "meta_conexiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
