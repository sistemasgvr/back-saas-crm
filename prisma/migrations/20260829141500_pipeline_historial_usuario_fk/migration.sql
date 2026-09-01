-- AddForeignKey
ALTER TABLE "lead_estado_historial" ADD CONSTRAINT "lead_estado_historial_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

