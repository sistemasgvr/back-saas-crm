-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "apellido" VARCHAR(120),
    "telefono" VARCHAR(40),
    "avatar_url" TEXT,
    "es_admin_plataforma" SMALLINT NOT NULL DEFAULT 0,
    "ultimo_login" TIMESTAMPTZ,
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "usuario_edicion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizaciones" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "razon_social" VARCHAR(255),
    "documento_fiscal" VARCHAR(50),
    "email_contacto" VARCHAR(255),
    "telefono_contacto" VARCHAR(40),
    "logo_url" TEXT,
    "pais" VARCHAR(2),
    "zona_horaria" VARCHAR(64) NOT NULL DEFAULT 'America/Lima',
    "notas" TEXT,
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "usuario_edicion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizacion_usuarios" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "rol" VARCHAR(30) NOT NULL,
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "usuario_edicion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organizacion_usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modulos" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" TEXT,
    "icono" VARCHAR(80),
    "orden" INTEGER NOT NULL DEFAULT 0,
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "usuario_edicion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "modulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizacion_modulos" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "modulo_id" UUID NOT NULL,
    "habilitado" SMALLINT NOT NULL DEFAULT 0,
    "fecha_activacion" TIMESTAMPTZ,
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "usuario_edicion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organizacion_modulos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_es_admin_plataforma_idx" ON "usuarios"("es_admin_plataforma");

-- CreateIndex
CREATE INDEX "usuarios_estado_idx" ON "usuarios"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "organizaciones_slug_key" ON "organizaciones"("slug");

-- CreateIndex
CREATE INDEX "organizaciones_estado_idx" ON "organizaciones"("estado");

-- CreateIndex
CREATE INDEX "organizacion_usuarios_usuario_id_idx" ON "organizacion_usuarios"("usuario_id");

-- CreateIndex
CREATE INDEX "organizacion_usuarios_rol_idx" ON "organizacion_usuarios"("rol");

-- CreateIndex
CREATE INDEX "organizacion_usuarios_estado_idx" ON "organizacion_usuarios"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "organizacion_usuarios_organizacion_id_usuario_id_key" ON "organizacion_usuarios"("organizacion_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "modulos_codigo_key" ON "modulos"("codigo");

-- CreateIndex
CREATE INDEX "organizacion_modulos_habilitado_idx" ON "organizacion_modulos"("habilitado");

-- CreateIndex
CREATE INDEX "organizacion_modulos_estado_idx" ON "organizacion_modulos"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "organizacion_modulos_organizacion_id_modulo_id_key" ON "organizacion_modulos"("organizacion_id", "modulo_id");

-- AddForeignKey
ALTER TABLE "organizacion_usuarios" ADD CONSTRAINT "organizacion_usuarios_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizacion_usuarios" ADD CONSTRAINT "organizacion_usuarios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizacion_modulos" ADD CONSTRAINT "organizacion_modulos_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizacion_modulos" ADD CONSTRAINT "organizacion_modulos_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "modulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
