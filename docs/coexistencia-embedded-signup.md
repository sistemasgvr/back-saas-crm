# Coexistencia WhatsApp Business y CRM

Implementación local para organizaciones que utilizan su propia aplicación Meta
 y un OAuth operativo con acceso a sus cuentas de WhatsApp. No desplegada.

## Fuentes oficiales consultadas el 28/10/2026

Se leyeron en el navegador integrado (el lector web devolvía 429):

- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users

La guía de implementación está actualizada al 24/07/2026 y la de coexistencia
al 26/06/2026. Graph v26.0 y Embedded Signup v4 son versiones independientes.
Meta indica que Embedded Signup v2/v3 quedaron obsoletas el 15/10/2026.

## Configuración necesaria en Meta

Cada aplicación debe ser elegible como Tech Provider o Solution Partner según
los requisitos de Meta. Completar App Review/accesos y habilitación necesarios
antes de clientes sin rol en la aplicación. El código no concede esa elegibilidad.

En Facebook Login for Business crear una configuración de **WhatsApp Embedded
Signup v4** con Cloud API y los permisos necesarios de WhatsApp. Habilitar
coexistencia. Autorizar el dominio HTTPS del frontend en dominios, redirects y
SDK JavaScript. Guardar el Configuration ID desde Configuración → WhatsApp → Conectar mi WhatsApp Business del celular. Se persiste en meta_conexiones.whatsapp_signup_config_id, asociado a la empresa y su App ID; ya no se utiliza una variable de entorno por aplicación. Solo PROPIETARIO/ADMINISTRADOR con módulo WHATSAPP pueden modificarlo. Cambiar App ID elimina el Configuration ID anterior para evitar mezclar aplicaciones.

No confundir Configuration ID con App ID, WABA ID ni Phone Number ID.
META_GRAPH_VERSION conserva v26.0 por defecto.

Suscribir la aplicación a messages, account_update, history,
smb_app_state_sync y smb_message_echoes; callback y verify token existentes.

## Implementación

La nueva tarjeta de Configuración → WhatsApp carga el SDK, prepara la app de
la organización y abre el flujo al segundo clic (evita bloquear el popup).
Usa featureType=whatsapp_business_app_onboarding; la configuración en Meta
selecciona v4. No impone parámetros legacy de v2/v3.

Solo acepta postMessage de orígenes HTTPS exactos de Facebook y el evento
FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING. Cancelaciones y errores no completan
el alta. Envía el code inmediatamente al servidor, sin esperar el evento, por
su vencimiento de 30 segundos. El servidor comprueba is_valid y app_id,
cifra el grant y devuelve únicamente un ID de sesión ligado a usuario,
organización y conexión. La sesión vence en 15 minutos.

Después del evento, el servidor descubre el teléfono del WABA; si no llega
phone_number_id, exige un solo candidato. Exige is_on_biz_app=true,
platform_type=CLOUD_API y status=CONNECTED. Comprueba acceso con el OAuth
operativo existente, pertenencia y campos de webhook antes de vincular.
Este alcance requiere cuentas propias visibles en el OAuth de la organización;
no soporta usar una app central de proveedor para operar cuentas de clientes.

No sustituye el token OAuth usado para páginas/publicidad. No llama register,
deregister ni desconecta la app del celular. Persiste el enrutamiento antes
de suscribir para poder recibir webhooks de sincronización inmediatamente.
Solicita contactos e historial mediante smb_app_data y conserva los request_id.
La respuesta confirma solicitudes aceptadas, no historial completamente recibido.
Si la empresa no comparte historial, Meta notifica el error 2593109.

El alta reclama atómicamente la sesión para impedir sincronizaciones concurrentes.
Un fallo parcial conserva request_id y deja estado ERROR, sin reintentar
operaciones irrepetibles. Revisar esos IDs y el resultado en Meta antes de
repetir un alta. Las sesiones COMPLETO son idempotentes.

## Instalación y validación

Aplicar las migraciones 20261029000000_whatsapp_onboarding y
20261029001000_whatsapp_signup_config_por_empresa mediante el procedimiento
habitual de despliegue y regenerar Prisma Client. No se ha ejecutado en producción.
Los grants se cifran con META_TOKEN_ENCRYPTION_KEY y se vacían tras éxito/error;
las sesiones abandonadas conservan el grant cifrado y no son utilizables por
la API después de expira_en. Definir su purga en la política de retención.

Pruebas automatizadas: descubrimiento sin phone ID, orden de enrutamiento,
aislamiento, app ajena, número fuera de Cloud API, OAuth operativo sin acceso,
doble ejecución y sesión completada. TypeScript de backend y frontend.

Falta prueba real: configuración elegible en Meta, completar el flujo desde el
celular, observar CONNECTED/CLOUD_API y recepción de un mensaje entrante junto
con su eco saliente. Verificar paginación e historial voluminoso con una cuenta
de ensayo antes de habilitar grandes importaciones. El procesador actual de
webhooks es síncrono y puede requerir cola para historiales grandes.

Producción se mantuvo en solo lectura durante esta implementación.
