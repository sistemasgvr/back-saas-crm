-- AlterTable
ALTER TABLE "whatsapp_mensajes" ADD COLUMN     "responde_a_mensaje_id" UUID;

-- AddForeignKey
ALTER TABLE "whatsapp_mensajes" ADD CONSTRAINT "whatsapp_mensajes_responde_a_mensaje_id_fkey" FOREIGN KEY ("responde_a_mensaje_id") REFERENCES "whatsapp_mensajes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
