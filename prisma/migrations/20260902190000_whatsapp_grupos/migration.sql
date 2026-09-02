-- CreateTable
CREATE TABLE "whatsapp_grupos" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "whatsapp_conexion_id" UUID NOT NULL,
    "grupo_id_meta" VARCHAR(128) NOT NULL,
    "asunto" VARCHAR(200) NOT NULL,
    "descripcion" TEXT,
    "link_invitacion" TEXT,
    "modo_aprobacion_union" VARCHAR(10) NOT NULL DEFAULT 'off',
    "cantidad_participantes" INTEGER NOT NULL DEFAULT 0,
    "suspendido" BOOLEAN NOT NULL DEFAULT false,
    "estado" SMALLINT NOT NULL DEFAULT 1,
    "usuario_creacion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "whatsapp_grupos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_grupo_participantes" (
    "id" UUID NOT NULL,
    "whatsapp_grupo_id" UUID NOT NULL,
    "wa_id" VARCHAR(40) NOT NULL,
    "nombre" VARCHAR(200),
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_grupo_participantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_grupo_mensajes" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "whatsapp_grupo_id" UUID NOT NULL,
    "wamid" VARCHAR(128) NOT NULL,
    "direccion" VARCHAR(10) NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "texto" TEXT,
    "wa_id_remitente" VARCHAR(40),
    "nombre_remitente" VARCHAR(200),
    "media_id" VARCHAR(128),
    "media_mime_type" VARCHAR(100),
    "media_nombre_archivo" TEXT,
    "media_caption" TEXT,
    "media_es_voz" BOOLEAN,
    "media_tamano_bytes" INTEGER,
    "estado_entrega" VARCHAR(20),
    "fijado" BOOLEAN NOT NULL DEFAULT false,
    "datos_crudos" JSONB NOT NULL,
    "fecha_mensaje" TIMESTAMPTZ NOT NULL,
    "usuario_creacion" UUID,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_grupo_mensajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_grupo_mensajes_media" (
    "whatsapp_grupo_mensaje_id" UUID NOT NULL,
    "bytes" BYTEA NOT NULL,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_grupo_mensajes_media_pkey" PRIMARY KEY ("whatsapp_grupo_mensaje_id")
);

-- CreateIndex
CREATE INDEX "whatsapp_grupos_whatsapp_conexion_id_idx" ON "whatsapp_grupos"("whatsapp_conexion_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_grupos_organizacion_id_grupo_id_meta_key" ON "whatsapp_grupos"("organizacion_id", "grupo_id_meta");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_grupo_participantes_whatsapp_grupo_id_wa_id_key" ON "whatsapp_grupo_participantes"("whatsapp_grupo_id", "wa_id");

-- CreateIndex
CREATE INDEX "whatsapp_grupo_mensajes_whatsapp_grupo_id_fecha_mensaje_idx" ON "whatsapp_grupo_mensajes"("whatsapp_grupo_id", "fecha_mensaje");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_grupo_mensajes_organizacion_id_wamid_key" ON "whatsapp_grupo_mensajes"("organizacion_id", "wamid");

-- AddForeignKey
ALTER TABLE "whatsapp_grupos" ADD CONSTRAINT "whatsapp_grupos_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_grupos" ADD CONSTRAINT "whatsapp_grupos_whatsapp_conexion_id_fkey" FOREIGN KEY ("whatsapp_conexion_id") REFERENCES "whatsapp_conexiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_grupo_participantes" ADD CONSTRAINT "whatsapp_grupo_participantes_whatsapp_grupo_id_fkey" FOREIGN KEY ("whatsapp_grupo_id") REFERENCES "whatsapp_grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_grupo_mensajes" ADD CONSTRAINT "whatsapp_grupo_mensajes_whatsapp_grupo_id_fkey" FOREIGN KEY ("whatsapp_grupo_id") REFERENCES "whatsapp_grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_grupo_mensajes_media" ADD CONSTRAINT "whatsapp_grupo_mensajes_media_whatsapp_grupo_mensaje_id_fkey" FOREIGN KEY ("whatsapp_grupo_mensaje_id") REFERENCES "whatsapp_grupo_mensajes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
