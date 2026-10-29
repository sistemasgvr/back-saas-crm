# Consorcio: permisos y ciclo de vinculación de WhatsApp

Revisión del 28/10/2026 (Lima). Producción se consultó en transacciones de solo
lectura y Meta mediante GET. No se modificaron registros ni suscripciones reales.
Los cambios siguientes son de código local y no necesitan nuevas migraciones.

## Evidencia de producción

Ambas organizaciones tienen tokens válidos de su propia app y los mismos once
scopes concedidos. Incluyen `business_management`, `whatsapp_business_management`
y `whatsapp_business_messaging`. Suscripciones activas e iguales: `messages`,
`account_update`, `history`, `smb_app_state_sync`, `smb_message_echoes`; mismo
callback del backend. No se encontró una omisión de scopes básicos de WhatsApp.

Domaria: `CONNECTED`, `CLOUD_API`, `is_on_biz_app=true`, 3589 mensajes entrantes
registrados. WABA aprobado, negocio `verified`.

Consorcio, número terminado en 1537: `DISCONNECTED`, `ON_PREMISE`,
`is_on_biz_app=true`, sin mensajes entrantes registrados. WABA aprobado,
negocio `pending_submission`. Tiene un vínculo activo y tres vínculos inactivos
con distintos identificadores anteriores para el mismo número visible. El
número de pruebas terminado en 4545 también está inactivo en el CRM.
Las búsquedas de enrutamiento filtran `estado=1`; las filas históricas no
sustituyen la activa por coincidir en número visible.

Los cuatro últimos intentos de Embedded Signup estaban en `TOKEN`, sin WABA
ni phone ID. Obtener el código OAuth no confirma haber completado coexistencia.
No hay notificaciones `WHATSAPP_CUENTA` guardadas con un motivo de desconexión.
No se obtuvo el estado de acceso avanzado ni la elegibilidad de Embedded Signup
desde estas consultas. La diferencia de verificación empresarial y la propiedad
del portafolio no prueban por sí solas el motivo del cierre del diálogo de Meta.

## Defectos corregidos

- Al reactivar una fila se conservaba `estadoNumero` si el llamador omitía ese
  dato (Prisma ignora `undefined`). También se conservaba la salud del webhook.
  Ahora se usa el estado nuevo o `null`, se vuelve a comprobar la suscripción y
  se conserva el ID histórico para no separar conversaciones.
- Desvincular solo cambiaba `estado`. Ahora descarta el diagnóstico anterior y
  cancela los grants todavía pendientes de ese WABA/conexión, sin borrar chats.
- Desconectar Meta no desactivaba WhatsApp. Ahora se desactivan rutas, se
  cancelan grants pendientes y se limpia OAuth en una transacción. Se mantienen
  App ID, secreto y Configuration ID para una nueva autorización.
- El vínculo manual aceptaba IDs y nombres del navegador sin verificar su
  vigencia. Ahora comprueba acceso a la pareja WABA/phone ID, aislamiento y
  estado `CONNECTED/CLOUD_API` antes de guardar y suscribir. El rechazo explica
  que la app del teléfono puede funcionar aunque falte el alta de Cloud API.
- La caché del diagnóstico no compartía el prefijo invalidado al desvincular.
  Ahora se invalida junto con la lista; volver de OAuth también refresca los
  permisos y la configuración de WhatsApp.
- Un grant válido de otra funcionalidad podía crear una sesión de alta sin
  revisar scopes de WhatsApp. Ahora se enumeran los permisos faltantes antes
  de crearla; las sesiones pendientes expiradas descartan el token al iniciar
  otra conexión o intentar completarlas. Una sesión completa antigua no
  devuelve éxito si su vínculo ya no sigue activo.

Estas correcciones evitan datos y diagnósticos heredados. No convierten
`ON_PREMISE` en `CLOUD_API` ni confirman la recepción real: continúa pendiente
completar el alta de Consorcio en Meta y contrastar un mensaje real con los logs.

## Permisos y documentación

El OAuth general pide los scopes de la matriz de permisos, incluidos los dos de
WhatsApp con el módulo WHATSAPP activo; `business_management` permite descubrir
los WABA a través de `/me/businesses`. Embedded Signup toma los permisos de su
Configuration ID; no se agregaron scopes ajenos ni se cambiaron los permisos
de clientes en Meta. El acceso avanzado de la aplicación es una comprobación
distinta de los permisos concedidos al token.

- [Colección oficial de Meta: permisos Cloud API](https://www.postman.com/meta/whatsapp-business-platform/collection/wlk6lh4/whatsapp-cloud-api)
- [Meta: coexistencia con WhatsApp Business](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)

Los tests de regresión cubren reactivación, bajas locales, descarte de grants,
aislamiento, rechazo de números sin alta Cloud API, scopes omitidos y matriz
OAuth. No requieren credenciales de producción ni envían mensajes.
