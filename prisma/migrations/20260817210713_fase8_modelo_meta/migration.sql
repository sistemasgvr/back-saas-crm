-- CreateTable
CREATE TABLE "campanas" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "meta_campana_id" VARCHAR(64) NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "estado_meta" VARCHAR(40),
    "datos_crudos" JSONB,
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "usuario_edicion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "campanas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conjuntos_anuncios" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "campana_id" UUID NOT NULL,
    "meta_conjunto_id" VARCHAR(64) NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "estado_meta" VARCHAR(40),
    "datos_crudos" JSONB,
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "usuario_edicion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "conjuntos_anuncios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anuncios" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "conjunto_anuncio_id" UUID NOT NULL,
    "meta_anuncio_id" VARCHAR(64) NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "estado_meta" VARCHAR(40),
    "datos_crudos" JSONB,
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "usuario_edicion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "anuncios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "campana_id" UUID,
    "conjunto_anuncio_id" UUID,
    "anuncio_id" UUID,
    "formulario_id" VARCHAR(64),
    "id_externo" VARCHAR(64) NOT NULL,
    "nombre" VARCHAR(200),
    "email" VARCHAR(255),
    "telefono" VARCHAR(40),
    "datos_crudos" JSONB NOT NULL,
    "fecha_lead" TIMESTAMPTZ,
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "usuario_edicion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campanas_estado_idx" ON "campanas"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "campanas_organizacion_id_meta_campana_id_key" ON "campanas"("organizacion_id", "meta_campana_id");

-- CreateIndex
CREATE INDEX "conjuntos_anuncios_campana_id_idx" ON "conjuntos_anuncios"("campana_id");

-- CreateIndex
CREATE INDEX "conjuntos_anuncios_estado_idx" ON "conjuntos_anuncios"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "conjuntos_anuncios_organizacion_id_meta_conjunto_id_key" ON "conjuntos_anuncios"("organizacion_id", "meta_conjunto_id");

-- CreateIndex
CREATE INDEX "anuncios_conjunto_anuncio_id_idx" ON "anuncios"("conjunto_anuncio_id");

-- CreateIndex
CREATE INDEX "anuncios_estado_idx" ON "anuncios"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "anuncios_organizacion_id_meta_anuncio_id_key" ON "anuncios"("organizacion_id", "meta_anuncio_id");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE INDEX "leads_telefono_idx" ON "leads"("telefono");

-- CreateIndex
CREATE INDEX "leads_campana_id_idx" ON "leads"("campana_id");

-- CreateIndex
CREATE INDEX "leads_anuncio_id_idx" ON "leads"("anuncio_id");

-- CreateIndex
CREATE INDEX "leads_fecha_lead_idx" ON "leads"("fecha_lead");

-- CreateIndex
CREATE INDEX "leads_estado_idx" ON "leads"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "leads_organizacion_id_id_externo_key" ON "leads"("organizacion_id", "id_externo");

-- AddForeignKey
ALTER TABLE "campanas" ADD CONSTRAINT "campanas_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conjuntos_anuncios" ADD CONSTRAINT "conjuntos_anuncios_campana_id_fkey" FOREIGN KEY ("campana_id") REFERENCES "campanas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anuncios" ADD CONSTRAINT "anuncios_conjunto_anuncio_id_fkey" FOREIGN KEY ("conjunto_anuncio_id") REFERENCES "conjuntos_anuncios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_campana_id_fkey" FOREIGN KEY ("campana_id") REFERENCES "campanas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_conjunto_anuncio_id_fkey" FOREIGN KEY ("conjunto_anuncio_id") REFERENCES "conjuntos_anuncios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_anuncio_id_fkey" FOREIGN KEY ("anuncio_id") REFERENCES "anuncios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
