-- CreateTable
CREATE TABLE "notificaciones" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "mensaje" VARCHAR(500) NOT NULL,
    "payload" JSONB,
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "usuario_edicion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones_usuario" (
    "id" UUID NOT NULL,
    "notificacion_id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "leida" SMALLINT NOT NULL DEFAULT 0,
    "fecha_lectura" TIMESTAMPTZ,
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "usuario_edicion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notificaciones_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suscripciones_push" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" VARCHAR(255) NOT NULL,
    "auth" VARCHAR(255) NOT NULL,
    "user_agent" VARCHAR(255),
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "usuario_edicion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "suscripciones_push_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notificaciones_organizacion_id_idx" ON "notificaciones"("organizacion_id");

-- CreateIndex
CREATE INDEX "notificaciones_tipo_idx" ON "notificaciones"("tipo");

-- CreateIndex
CREATE INDEX "notificaciones_estado_idx" ON "notificaciones"("estado");

-- CreateIndex
CREATE INDEX "notificaciones_usuario_usuario_id_leida_idx" ON "notificaciones_usuario"("usuario_id", "leida");

-- CreateIndex
CREATE INDEX "notificaciones_usuario_organizacion_id_usuario_id_idx" ON "notificaciones_usuario"("organizacion_id", "usuario_id");

-- CreateIndex
CREATE INDEX "notificaciones_usuario_notificacion_id_idx" ON "notificaciones_usuario"("notificacion_id");

-- CreateIndex
CREATE INDEX "notificaciones_usuario_estado_idx" ON "notificaciones_usuario"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "notificaciones_usuario_notificacion_id_usuario_id_key" ON "notificaciones_usuario"("notificacion_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "suscripciones_push_endpoint_key" ON "suscripciones_push"("endpoint");

-- CreateIndex
CREATE INDEX "suscripciones_push_usuario_id_idx" ON "suscripciones_push"("usuario_id");

-- CreateIndex
CREATE INDEX "suscripciones_push_organizacion_id_idx" ON "suscripciones_push"("organizacion_id");

-- CreateIndex
CREATE INDEX "suscripciones_push_estado_idx" ON "suscripciones_push"("estado");

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones_usuario" ADD CONSTRAINT "notificaciones_usuario_notificacion_id_fkey" FOREIGN KEY ("notificacion_id") REFERENCES "notificaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones_usuario" ADD CONSTRAINT "notificaciones_usuario_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones_usuario" ADD CONSTRAINT "notificaciones_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suscripciones_push" ADD CONSTRAINT "suscripciones_push_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suscripciones_push" ADD CONSTRAINT "suscripciones_push_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
