# Fase 1: control humano de WhatsApp — backend

Implementación: 7 de octubre de 2026. Control administrativo completado: 9 de octubre de 2026. Alcance ampliado el 9 de octubre de 2026: **backend y UI**. El bot real, los endpoints de n8n, OpenAI, el catálogo aprobado y los horarios se implementan en sus fases posteriores. No se ha habilitado atención automática para ninguna empresa.

## Comportamiento

El asesor puede tomar control antes de enviar o hacerlo implícitamente con su primer envío válido. Leer el chat y mostrar que está escribiendo no toman control. La asignación del lead y el pipeline siguen siendo independientes. Una transferencia mantiene el control humano.

Desde que se registra una solicitud de toma, el backend rechaza nuevas salidas BOT. Si un envío BOT ya estaba en curso, devuelve `TOMANDO_CONTROL`; la confirmación `HUMANO_ACTIVO` se produce cuando ese intento termina. Una petición anterior puede entregarse tarde en WhatsApp. No existe un endpoint de reanudación automática.

Los recordatorios de agenda conservan el actor `SYSTEM` y siguen funcionando con atención humana, siempre que la línea y el contacto permitan enviar. Los envíos BOT no pueden sustituir ese actor desde HTTP: los endpoints actuales de mensajes siempre construyen el actor humano con la sesión autenticada.

## Persistencia

| Dato | Uso |
| --- | --- |
| `modoAtencion` | `MANUAL`, `BOT_ACTIVO`, `ESPERANDO_HUMANO`, `TOMANDO_CONTROL`, `HUMANO_ACTIVO`, `PAUSADO`, `CERRADO` |
| `fasePrecalificacion` | Estado independiente, inicialmente `NO_INICIADA`; se desarrollará con la precalificación |
| `controlVersion` | Cambia con solicitud, confirmación, transferencia y suspensión; invalida resultados anteriores |
| `entradaRevision` | Aumenta al persistir una entrada nueva de cliente; los duplicados y el historial no la incrementan |
| `controlUsuarioId` | Responsable del control, independiente del dueño del lead |
| `controlSolicitadoEn`, `controlTomadoEn`, `controlMotivo` | Solicitud, confirmación y motivo |
| `WhatsappControlEvento` | Historial inmutable; versión única por conversación y deduplicación de ecos por `wamid` |
| `WhatsappSalidaIntento` | Intento durable previo al envío; actor, clave, versión, estado, `wamid`, fechas y persistencia del mensaje |
| `WhatsappBotConfiguracion` | Configuración mínima por organización; ausencia o `habilitado=false` bloquean BOT |

Las conversaciones se crean en `MANUAL`. Una entrada nueva que crea el chat puede aplicar la preferencia BOT únicamente cuando exista autorización y motor operativo. La integración aún declara `operativa=false`, por lo que se conserva atención manual. Habilitar el permiso o cambiar la preferencia no modifica chats existentes.

La identidad es `(organizacionId, whatsappConexionId, waId)` o su equivalente con BSUID. La migración conserva los IDs de conversaciones, mensajes, archivos y leads; permite que un mismo contacto tenga chats independientes en líneas diferentes. Los envíos usan la conexión del chat y su sesión Meta activa, nunca la primera línea de la empresa.

Los autores persistidos son `HUMAN`, `BOT`, `SYSTEM`, `EXTERNAL`, `UNKNOWN` y `CUSTOMER` para entradas. Se mantiene `usuarioCreacion` cuando hay identidad humana comprobada. El backfill clasifica entradas, mensajes con creador humano y recordatorios con origen explícito; los demás salientes históricos siguen como `UNKNOWN`.

## API consumida por el frontend

Todos los endpoints conservan JWT, membresía activa, módulo `WHATSAPP` y organización de la sesión. No aceptan organización ni actor enviados por el navegador.

| Método | Ruta | Cuerpo / respuesta |
| --- | --- | --- |
| GET | `/whatsapp/chats/:id/control` | Estado canónico, responsable, fechas, versión e intentos que requieren revisión |
| POST | `/whatsapp/chats/:id/control/tomar` | `{ "controlVersion": 0 }`; devuelve estado canónico |
| GET | `/whatsapp/chats/:id/control/asesores` | Miembros activos elegibles; exige control humano confirmado y permiso del operador |
| POST | `/whatsapp/chats/:id/control/transferir` | `{ "controlVersion": 2, "usuarioId": "UUID" }`; mantiene atención humana |
| GET | `/whatsapp/chats/:id/control/historial` | Hasta 100 eventos recientes, ordenados por versión descendente |
| POST | `/whatsapp/chats/:id/control/asignar-bot` | `{ "controlVersion": 2 }`; retorno explícito auditado, con permisos y motor operativo |
| GET/PATCH | `/whatsapp/bot/preferencias` | PATCH `{ "modoInicial": "HUMANO", "preferenciasVersion": 0 }`; solo propietario/administrador edita |

Ejemplo de respuesta de control:

```json
{
  "modoAtencion": "HUMANO_ACTIVO",
  "controlVersion": 2,
  "entradaRevision": 1,
  "controlUsuarioId": "UUID-del-asesor",
  "responsable": { "id": "UUID-del-asesor", "nombre": "Asesor", "apellido": null },
  "controlSolicitadoEn": "2026-10-07T20:00:00.000Z",
  "controlTomadoEn": "2026-10-07T20:00:00.100Z",
  "controlMotivo": "toma_explicita",
  "intentos": []
}
```

`200` puede incluir `TOMANDO_CONTROL`: no presentar ese estado como una toma confirmada. `409` indica versión obsoleta, otro responsable, envío pendiente o resultado incierto. `403` indica falta de permiso; `404` no revela conversaciones de otras empresas.

Los permisos de escritura se revalidan dentro de la coordinación: administrador/propietario, dueño del lead o conversación libre. En un chat libre, el responsable actual impide que otro asesor envíe sin transferencia; un administrador puede asumirlo. El destinatario de una transferencia debe ser miembro activo y tener permiso de escritura sobre el lead. Si hay que reasignar un lead, hacerlo con el flujo autorizado del CRM; esto no reanuda el bot.

Los listados y detalles de chat incluyen `whatsappConexionId`, `modoAtencion`, `controlVersion`, `controlUsuarioId`; los mensajes incluyen `autorTipo`. Evento Socket.IO `whatsapp:control`, en la sala de la organización, incluye `{ conversacionId, controlVersion }`. La UI consulta el estado canónico al recibirlo y al reconectar; no aplica payloads de eventos sobre el estado. Las consultas y mutaciones conservan la versión más reciente en caché. Incluye toma, transferencia, historial, autoría, espera y administración por empresa.

## Coordinación y puerta de salida

`ControlAtencionService` usa un advisory lock transaccional PostgreSQL con una clave de organización y conversación, normalizada a minúsculas, y aislamiento explícito `READ COMMITTED`. Los procesos comparten PostgreSQL; no dependen de un mutex de memoria ni de la caducidad de Redis.

1. Preparar contenido, credenciales y archivos antes de despachar.
2. Para HUMAN, solicitar y confirmar control antes del envío.
3. En una transacción corta, revalidar conversación, bloqueo, permisos, estado, versión, revisión de entrada, ventana y línea; registrar `DESPACHANDO`.
4. Fuera de la transacción, iniciar **una** petición al proveedor. Cada parte de un lote cruza la puerta por separado.
5. Guardar `ACEPTADO` y `wamid`, o `INCIERTO` ante un error de entrega. Confirmar la toma pendiente si ya no hay intentos BOT en curso.
6. Persistir el mensaje y vincular su autoría al intento; si el eco llegó antes, corregir su autor con la evidencia del intento aceptado.

Se incorporó esta puerta a texto, plantillas, archivos, ubicaciones, contactos, interactivos, reacciones, reenvíos, recordatorios y mensajes para solicitar permiso de llamada. Las confirmaciones de lectura y el indicador humano de escritura son efectos de lectura, y no toman control. Las llamadas de voz no se convierten en mensajes del bot.

El futuro gateway BOT deberá usar el servicio con `configVersion`, `controlVersion`, `entradaRevision` y una `clave` estable por salida. Una clave ya intentada se rechaza, incluso tras timeout. Ese contrato es interno: no hay un endpoint n8n que permita falsificar el actor o llamar directamente a Graph.

`detenerBot()` permite al futuro gateway derivar a `ESPERANDO_HUMANO`, pausar o cerrar una atención BOT con versión esperada. Nunca reemplaza atención humana ni reactiva el bot. Cuotas, horarios, expiración de ejecuciones y aprobación de contenido pertenecen a fases posteriores; no activar el bot antes de incorporarlos.

## Coexistencia con WhatsApp Business

La toma desde el CRM debe ocurrir antes de responder desde la app. Un eco nuevo desconocido puede detectar una respuesta externa, pero la garantía empieza al procesarlo, no cuando alguien toca el teléfono.

Los ecos de mensajes conocidos por `wamid`, los intentos aceptados y el historial no toman control. Un eco sin atribución mientras hay intentos en curso o inciertos pausa la automatización con motivo `eco_no_atribuido`, sin afirmar que lo envió un asesor. Los reintentos simultáneos de ese mismo eco no duplican la intervención. La atribución se puede corregir al llegar evidencia; la pausa no se revierte sola.

## Envíos inciertos y recuperación

Las peticiones JSON a Meta tienen timeout de 30 segundos y no se reintentan automáticamente. Un timeout no prueba que Meta haya descartado el mensaje.

`GET :id/control` devuelve hasta 20 intentos recientes `DESPACHANDO`, `INCIERTO` o `ACEPTADO` cuyo mensaje aún no se guardó. Un `wamid` aceptado pendiente de persistir permite reconciliar la entrega sin volver a enviar.

Si un proceso cae después de reservar `DESPACHANDO`, el intento no caduca: la conversación puede seguir en `TOMANDO_CONTROL`. Recuperación operativa:

1. Identificar organización, conversación e intento; comprobar el historial y la entrega en el proveedor.
2. Detener definitivamente el proceso que reservó el intento y cualquier ejecución que aún pueda iniciar esa petición. Si no puede demostrarse, mantener el bloqueo. No liberar por un TTL.
3. Con esas ejecuciones detenidas, reconciliar el intento en una intervención administrativa: conservar `wamid` si existe evidencia de aceptación, o registrar `INCIERTO` si no puede conocerse el resultado. Mantener la clave consumida.
4. Consultar el estado canónico: confirmará la toma pendiente al no quedar BOT `DESPACHANDO`.
5. Resolver la persistencia pendiente a partir de evidencia; un nuevo envío humano debe ser una decisión explícita.

No se expone un endpoint que libere a ciegas un intento de un proceso posiblemente vivo. El historial de control tiene un trigger que impide `UPDATE` y `DELETE`; no modificarlo para corregir una incidencia.

## Migración y verificación

Migración preparada: `prisma/migrations/20261007120000_whatsapp_control_humano/migration.sql`. Es transaccional; el backfill de autoría usa lotes de 500. No fue aplicada a la base remota configurada en el proyecto.

Antes de desplegar, ejecutar las pruebas contra una base PostgreSQL local dedicada cuyo nombre termine en `_test`, mediante `WHATSAPP_CONTROL_TEST_DATABASE_URL`. El arnés crea un esquema aleatorio, aplica primero las migraciones anteriores, siembra un chat histórico, aplica las migraciones de control humano y administración del bot y elimina exclusivamente su esquema y carpeta temporal. No toma la variable `DATABASE_URL` de desarrollo/producción como destino de pruebas.

```powershell
# Definir la URL de la base local de pruebas en el entorno, sin publicarla.
npm run test:control:integration
npm test -- --runInBand
npm run build
```

La integración incluye dos procesos backend separados, carrera toma/despacho, dos asesores, backfill, inmutabilidad, restricciones de tenant e identidad entre líneas. Sin una URL local explícita se **omite**, no se considera aprobada.

Evidencia local: **22 suites y 188 pruebas aprobadas**, TypeScript, build NestJS, generación del cliente, validación del esquema Prisma y lint sobre archivos modificados. La resolución de dependencias Nest de chat/llamadas/notificaciones se probó sin inicializar servicios externos. La validación local de migraciones y concurrencia con PostgreSQL real se completó el 9 de octubre de 2026: siete pruebas de integración aprobadas. La validación de despliegue en producción sigue pendiente. No se enviaron mensajes reales ni se probaron n8n/OpenAI/Meta.

Aplicar `prisma migrate deploy` únicamente en el entorno de despliegue identificado, antes de arrancar el backend nuevo. Conservar respaldo y comprobar conversaciones, medios y recordatorios en staging. No usar `db push` para sustituir esta migración: contiene restricciones e historial inmutable que deben conservarse. El rollback operativo inicial mantiene el bot apagado; no eliminar tablas de evidencia ni regenerar IDs históricos.

## Administración del bot por organización (puntos 1 y 2)

Rutas bajo el prefijo global `/api`, exclusivas para un usuario activo con `esAdminPlataforma=1`. Los permisos se verifican en base de datos en el guard y dentro de la transacción; ser propietario o administrador de una empresa no concede este permiso. No se requiere membresía del administrador de plataforma en la empresa destino.

| Método | Ruta | Función |
| --- | --- | --- |
| GET | `/admin/organizations/:organizacionId/whatsapp-bot` | Configuración canónica y envíos BOT en curso |
| PATCH | `/admin/organizations/:organizacionId/whatsapp-bot` | Establecer habilitación con versión esperada y motivo |
| GET | `/admin/organizations/:organizacionId/whatsapp-bot/historial` | Hasta 100 cambios recientes de esa empresa |

Ejemplo de PATCH después de consultar GET:

```json
{ "habilitado": true, "configVersion": 0, "motivo": "Activación del piloto" }
```

`habilitado` debe ser booleano; `configVersion` debe ser entero no negativo; `motivo` se recorta y debe contener entre 8 y 500 caracteres. La respuesta incluye `organizacionId`, `habilitado`, `configVersion`, `actualizadoPor`, `actualizadoEn`, `despachosEnCurso` y `desactivacionPendiente`. Una configuración inexistente equivale a deshabilitado y versión 0. Cada cambio real incrementa la versión y registra actor, motivo y valores anterior/nuevo en auditoría inmutable. Una repetición del mismo valor con versión vigente no duplica eventos. Las versiones obsoletas devuelven 409.

Habilitar exige organización activa y módulo WHATSAPP activo/habilitado. Deshabilitar sigue permitido si la empresa o módulo están inactivos. El gate comprueba nuevamente el módulo antes de reservar cada salida BOT.

La actualización administrativa y las reservas de mensajes comparten un advisory lock por organización, siempre anterior al lock de conversación. No se mantiene la transacción durante llamadas a Meta. Una vez confirmada la desactivación, no se reservan nuevas salidas BOT. Si una salida ya se reservó, puede terminar: la respuesta indica `desactivacionPendiente=true` mientras queden intentos BOT `DESPACHANDO`; no afirmar que se canceló una petición externa. No se permite reactivar mientras sigan esos intentos. Para caídas de proceso se aplica la reconciliación documentada; no se liberan por tiempo.

El actor interno BOT debe aportar la `configVersion` observada antes de generar, además de las versiones de conversación y entrada. Desactivar/reactivar invalida propuestas antiguas aunque la conversación no haya cambiado. Ninguna actualización de habilitación modifica conversaciones: HUMANO_ACTIVO, TOMANDO_CONTROL, PAUSADO, CERRADO y MANUAL se conservan. Los recordatorios de agenda SYSTEM y los envíos humanos conservan sus reglas propias. La habilitación de empresa no pone chats manuales en BOT_ACTIVO; esa selección pertenece a fases posteriores.

## Estado de entrega y despliegue pendiente

Puntos 1 y 2 completados en backend y UI. La integración n8n/OpenAI corresponde a las fases siguientes. Se preparó `20261009120000_whatsapp_bot_admin` después de la migración de control humano, para versionado y auditoría administrativa. **Inicialmente se entregaron sin ejecutar; posteriormente el usuario autorizó aplicarlas únicamente en una copia local de producción. Las dos migraciones se aplicaron allí correctamente. Producción permanece sin cambios.** Estos endpoints requieren ambos cambios de esquema antes de usarse en un entorno real.

Verificación local: 22 suites / 188 pruebas unitarias aprobadas. La concurrencia se simula en memoria; Los locks, constraints, triggers y carreras entre procesos se validaron en PostgreSQL 18 local mediante las siete pruebas de integración; sigue pendiente la validación del despliegue y coexistencia con el proveedor en producción. El arnés de integración está actualizado para ejecutar primero migraciones anteriores a fase 1 y después las de control y administración, únicamente con una base local de pruebas explícita.
## Copia local autorizada — 9 de octubre de 2026

Se restauró producción en crm_gvr_local_20261009, en 127.0.0.1:55432, y se aplicaron cuatro migraciones de la fase 1. Se conservaron 939 conversaciones, 10 567 mensajes, 1 054 leads y 9 usuarios. La última migración conservó 938 chats MANUAL y uno HUMANO_ACTIVO; no activó el bot. Las siete pruebas PostgreSQL pasaron en otra base local aislada. La conexión de desarrollo apunta a la copia; las conexiones Meta/WhatsApp están aisladas; MinIO online se reutiliza por indicación posterior del usuario. Producción no fue modificada. Consulta [operación local](desarrollo-local.md), incluida la configuración de MinIO online.

## Interfaz integrada

El chat incorpora estados, responsable/fecha, toma y transferencia con versión esperada, historial, autoría y aviso de entrega incierta. Los permisos bloquean el editor y las modalidades de salida sin control. El detalle de empresa en administración SaaS incorpora habilitación/desactivación con motivo e historial. El selector de transferencia utiliza el endpoint de asesores elegibles; los historiales incluyen nombres de actor y responsable.

TypeScript y build Next aprobados. Los componentes nuevos pasan lint; ChatDetailView conserva tres errores React preexistentes. Los flujos de navegador se comprobaron con PostgreSQL y endpoints reales, usando almacenamiento simulado únicamente en un arnés temporal. Véase [evidencia UI y regresión pendiente](../../planificacion/fase-1/VALIDACION-UI.md).

## Ampliación de automatizaciones

El bot requiere WHATSAPP + AUTOMATIZACIONES y permiso de plataforma. Preferencias y permiso usan versiones independientes. La nueva migración 20261009233000_bot_preferencias_empresa está aplicada únicamente en la copia local; conserva chats y datos. El retorno explícito autorizado sustituye la prohibición anterior del MVP. Consulta [contrato y estado real de n8n central](../../planificacion/fase-1/AUTOMATIZACIONES-Y-N8N.md). El endpoint administrativo GET /api/admin/automations/integration muestra solo metadatos; no invoca workflows ni devuelve secretos.

## Ajustes de atención y configuración — 9/10/2026

La mano distingue dos acciones: **Tomar chat del asesor** para un chat humano asignado a otra persona, y **Atender yo** para asumir atención del bot. La primera exige propietario/administrador, confirma el asesor actual y reasigna lead y control en una sola transacción; compara responsable observado y versión para rechazar cambios concurrentes con 409. No permite tomar durante un envío humano/bot en despacho. La segunda conserva la asignación del lead. Los recordatorios SYSTEM se mantienen.

POST /api/whatsapp/chats/:id/control/asumir-humano recibe { controlVersion, asignadoUsuarioId }, donde el responsable esperado puede ser null. La autorización se revalida con membresía y permisos actuales.

El menú de tres puntos se sitúa al final de la cabecera y conserva todas las acciones autorizadas en escritorio y móvil. Un chat MANUAL con lead asignado muestra **Atención humana** en la lista; esta etiqueta no activa ni desactiva el motor.

La conexión central n8n se edita desde Módulos → Automatizaciones → Configurar. GET/PATCH /api/admin/automations/integration son exclusivos de plataforma. URL, cabecera, versión y secreto cifrado se guardan en PostgreSQL; el secreto no vuelve al navegador ni se incluye en la auditoría. Una edición sin secreto conserva el anterior. La clave maestra de cifrado permanece en el entorno del backend. Configuración guardada no equivale a ejecución operativa: outbox y callbacks siguen pendientes de fase 2.
