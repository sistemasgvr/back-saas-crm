# Recepción de WhatsApp — revisión del 1 de octubre de 2026

Línea: Domaria Inmobiliaria, +51 903 507 698.

## Evidencia comprobada en producción

- Último mensaje entrante persistido: 23 de septiembre, 10:27:08 (Lima).
- Último mensaje saliente persistido: 23 de septiembre, 10:26:57 (Lima).
- El usuario confirma que los mensajes nuevos llegan a la aplicación del celular.
- La app está suscrita al WABA. `messages`, `smb_message_echoes`, `history` y `smb_app_state_sync` están activos en v26.0 y apuntan al backend correcto.
- Una petición POST con firma HMAC válida, los IDs reales y un arreglo de mensajes vacío devuelve HTTP 200 `OK`. Esta prueba verifica ruta, token de URL, firma y resolución de conexión, pero no prueba la persistencia de un mensaje nuevo ni la entrega desde Meta.
- La línea tiene `rolLinea=MENSAJES` y `callingHabilitado=0` en el CRM.
- Meta informa `platform_type=ON_PREMISE`, `is_on_biz_app=true`, `code_verification_status=NOT_VERIFIED`, `status=CONNECTED` y throughput `NOT_APPLICABLE`. El endpoint del perfil empresarial responde correctamente. Estos datos requieren revisar la vinculación de coexistencia; por sí solos no prueban su desconexión.
- La salud del WABA informa bloqueos de envío: `141006` (método de pago) y `141007` (zona horaria). No se ha demostrado que expliquen la ausencia de mensajes entrantes.

## Revisión del código

La implementación de llamadas añadió un manejador independiente; los mensajes se procesan antes que las llamadas. Las pruebas verifican un payload mixto, un fallo de llamadas y el rechazo de una firma inválida. No se encontró una regresión de recepción atribuible a llamadas en los caminos revisados.

Se añadieron logs de recepción y cantidades por tipo en el controller. No imprimen el contenido de mensajes, contactos, firmas ni tokens. Estos cambios están en el repositorio local y requieren desplegar el backend.

## Próxima comprobación

### Actualización tras desplegar Pino y realizar pruebas reales

El usuario envió mensajes reales y confirmó que no apareció ningún POST del webhook en los logs. Las pruebas del panel de Meta sí llegaron y se rechazaron con `resolvedSecrets=0`, cuerpo crudo y firma presentes: no se encontró una conexión correspondiente a los IDs del payload de prueba.

En una nueva consulta de Graph, tras revincular y resuscribir desde el CRM, el estado del número pasó a `DISCONNECTED`. La app sigue suscrita al WABA y los campos de v26.0 siguen activos. Una prueba firmada vacía sigue devolviendo 200. Esto sitúa el siguiente paso en revisar/restablecer la conexión de la línea con la plataforma de Meta; resuscribir la app al WABA no demuestra que el número esté operativo. No se ejecutó registro, desregistro ni cambio de conexión del número.

Tras desplegar, realizar una prueba real desde otro celular y observar EasyPanel:

1. Si no aparece `Webhook Meta recibido` ni una advertencia de rechazo, comprobar en Meta la entrega del evento y el vínculo de la app Business con la plataforma. El éxito del botón de prueba de Meta no demuestra entrega de eventos reales.
2. Si aparece un rechazo de token o firma, revisar configuración del callback y credenciales de la app.
3. Si aparece `Webhook WhatsApp: mensajes=1`, seguir el error de procesamiento o verificar el mensaje en la base y su visibilidad en el CRM.
4. Si hay HTTP 503, Meta debe reintentar; el error contiguo identifica el paso que falló.

Los problemas de pago y zona horaria deben corregirse en la cuenta de Meta para el envío. No se ejecutó registro, desregistro, cambio de suscripción ni envío de mensajes durante este diagnóstico.

## Repetir diagnóstico

Desde el backend, `node scripts/diagnosticar-whatsapp.cjs` consulta la base y Graph usando `.env.production`. `--probe` añade la prueba firmada vacía y consultas de salud. El script requiere acceso de red y no imprime credenciales ni contenido de conversaciones.

La documentación de Meta Developers devolvió HTTP 429 durante la consulta; no se pudo verificar el changelog completo de v26.0. Las suscripciones y consultas de v26.0 anteriores se comprobaron directamente contra Graph.
