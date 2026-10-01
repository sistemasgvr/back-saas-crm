# Logs del backend

Pino está integrado globalmente mediante `nestjs-pino`. Los servicios y controllers que usan `Logger` de Nest mantienen su contexto y escriben JSON a stdout. EasyPanel/Docker recoge esa salida; no se necesita un archivo de logs dentro del contenedor.

## Despliegue

Reconstruir y desplegar el backend con el Dockerfile actualizado. Builder y runtime usan `node:24-bookworm-slim` (Node 24 LTS). `package.json` requiere Node >=24 y `.nvmrc` indica la versión para desarrollo. Es necesario reconstruir la imagen para sustituir el Node 20 del contenedor anterior.

`LOG_LEVEL=info` es el valor predeterminado. Registra arranque, peticiones HTTP y eventos del webhook. Para depuración temporal puede usarse `debug`. `warn` o `error` ocultan las peticiones exitosas; `silent` deshabilita la salida de Pino. No se requiere cambiar variables para activar los logs.

## Seguir una solicitud

Cada petición recibe un `x-request-id` en la respuesta. Si el cliente envía un ID con caracteres alfanuméricos, guiones o guiones bajos y hasta 64 caracteres, se conserva; de lo contrario se genera un UUID. Los logs de HTTP y de los servicios ejecutados durante esa petición comparten `req.id`.

Las peticiones registran método, ruta sin query string, estado y `responseTime` en milisegundos. Los estados 4xx usan nivel `warn`; errores y estados 5xx usan `error`. Las marcas de tiempo son ISO en UTC. Los errores registrados bajo `err` incluyen tipo, mensaje, stack y código cuando está disponible.

## WhatsApp

Buscar `MetaWebhooksController`, `VerificarWebhookMetaUseCase` y el ID de solicitud:

- `Webhook Meta recibido`: pasó token de URL y firma.
- `Webhook WhatsApp`: cantidades de mensajes, ecos, estados y llamadas reconocidos.
- `meta_webhook_rejected`: firma rechazada; indica si hay body crudo, si llegó una firma y si su formato es válido. No publica la firma.
- `meta_webhook_signature_rejected`: indica cuántos secretos de conexiones se resolvieron y si hay fallback legacy. `resolvedSecrets=0` puede indicar IDs ficticios del botón de prueba o un recurso sin conexión; un valor positivo indica que hubo una conexión resuelta, pero la firma no coincidió.
- `Solicitud HTTP fallida` con estado 403 o 503: relacionar con los registros anteriores usando `req.id`.

Si un mensaje nuevo no produce ningún log de recepción o rechazo, revisar la entrega desde Meta y la vinculación de coexistencia. Si el evento llega, los logs permiten distinguir verificación, extracción y procesamiento.

## Privacidad

El logger HTTP no serializa query strings, cabeceras, cookies, bodies ni respuestas de negocio. Oculta campos de credenciales conocidos y sanea tokens en URLs, autorizaciones Bearer y credenciales de URLs de conexión en mensajes/errores. El serializer de errores omite la configuración, request y response de clientes HTTP.

Al añadir logs nuevos, registrar eventos y contadores, nunca cuerpos completos, secretos o contenido de conversaciones. La redacción de campos no puede identificar cualquier secreto incorporado arbitrariamente en un texto.
