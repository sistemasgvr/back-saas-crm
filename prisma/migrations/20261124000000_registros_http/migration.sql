CREATE TABLE "registros_http" (
  "id" UUID NOT NULL,
  "fecha" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "request_id" VARCHAR(64) NOT NULL,
  "usuario_id" UUID,
  "organizacion_id" UUID,
  "sesion_id" UUID,
  "solicitud" JSONB NOT NULL,
  "ip" VARCHAR(64),
  "estado_http" INTEGER NOT NULL,
  "duracion_ms" INTEGER NOT NULL,
  "abortada" BOOLEAN NOT NULL DEFAULT false,
  "error_tipo" VARCHAR(120),
  "error_mensaje" VARCHAR(4000),
  "error_stack" VARCHAR(12000),
  CONSTRAINT "registros_http_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "registros_http_fecha_idx" ON "registros_http"("fecha");
CREATE INDEX "registros_http_ip_fecha_idx" ON "registros_http"("ip", "fecha");
CREATE INDEX "registros_http_usuario_id_fecha_idx" ON "registros_http"("usuario_id", "fecha");
CREATE INDEX "registros_http_organizacion_id_fecha_idx" ON "registros_http"("organizacion_id", "fecha");
CREATE INDEX "registros_http_sesion_id_fecha_idx" ON "registros_http"("sesion_id", "fecha");
CREATE INDEX "registros_http_request_id_idx" ON "registros_http"("request_id");
CREATE INDEX "registros_http_estado_http_fecha_idx" ON "registros_http"("estado_http", "fecha");
