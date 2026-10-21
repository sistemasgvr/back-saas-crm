-- Estado RECHAZADO: Meta respondió con error (4xx); la salida no se entregó.
BEGIN;
ALTER TABLE "whatsapp_salida_intentos" DROP CONSTRAINT "wa_intento_estado_check";
ALTER TABLE "whatsapp_salida_intentos" ADD CONSTRAINT "wa_intento_estado_check"
 CHECK (estado IN ('DESPACHANDO','ACEPTADO','INCIERTO','RECHAZADO'));
COMMIT;
