# Cierre de validación local de flujos — 21/10/2026

## Resultado

**193 pruebas de backend, 10 de integración PostgreSQL y 58 comprobaciones de
acciones por API aprobadas.** También se revisaron recorridos de la interfaz en
el navegador integrado propio, con roles de propietario, asesor y plataforma.
No se desplegó ni se modificó la base de producción.

Automatizaciones queda apagado para el cliente. La validación local permite
preparar el despliegue; las integraciones externas y un respaldo reciente de
producción siguen siendo comprobaciones pendientes antes de publicarlo.

## Matriz de flujos comprobados

| Flujo | Acciones verificadas | Medio y resultado |
| --- | --- | --- |
| Sesión | Login válido e inválido, salida, refresh único, renovaciones simultáneas, cierre de toda la familia, sesiones independientes, tokens anteriores a la migración y carrera entre logout y refresh | Interfaz y API; aprobado |
| Perfil | Editar y guardar datos; contraseña actual incorrecta, contraseña nueva y rechazo de la anterior | Interfaz para datos, API para contraseña; aprobado |
| Permisos | Asesor ve sus leads; no accede a administración ni configura empresa; navegación directa a configuración redirige a perfil; no lee ni modifica leads de otra empresa | Interfaz y API; aprobado |
| Dashboard | KPIs, series, inversión y embudo; estado sin datos publicitarios | Interfaz y API; aprobado |
| Leads | Listado y detalle, renombrar, historial, asignar, liberar, tomar, consultar tablero y metadatos del pipeline | Interfaz y API; aprobado |
| Pipeline | Transición Nuevo → Contactado con canal y nota; historial visible; rechazo de tipo y configuración inválidos | Interfaz y API; aprobado |
| Agenda | Crear, reprogramar y completar actividad; crear, reprogramar y cancelar visita; rechazo de fechas pasadas; mostrar cambios guardados | Interfaz y API; aprobado |
| Inmuebles | Alta, detalle, edición, duplicado rechazado, interesados, selectores y baja lógica | Interfaz y API; aprobado |
| Chats | Lista, mensajes previos, detalle, control, toma por propietario, cambio del responsable e historial; transferencia sin asesores elegibles bloqueada en pantalla | Interfaz y API; aprobado |
| Control humano | Exclusión entre procesos, carreras de versiones, integridad por empresa y auditoría inmutable | Pruebas PostgreSQL; aprobado |
| Salidas rechazadas | Tratamiento del rechazo explícito de Meta; PostgreSQL acepta RECHAZADO y rechaza estados desconocidos | Pruebas unitarias y PostgreSQL; aprobado con proveedor simulado, sin envío real |
| Llamadas | Historial, capacidad, presencia y métricas sin cuenta real conectada | API; aprobado para consultas locales |
| Notificaciones | Lista, contador, ticket de socket y marcar leídas | Interfaz y API; aprobado |
| Empresa | Consultar y guardar datos; crear y editar empresa desde plataforma | Interfaz y API; aprobado |
| Usuarios | Crear con membresía, consultar, desactivar, activar y cambiar rol | API y revisión de cambios de estado y rol en interfaz; aprobado |
| Módulos | Consultar, crear, editar y desactivar un módulo sintético; matriz por empresa | Interfaz y API; aprobado |
| Automatizaciones | Oculto en configuración del cliente; BOT rechazado incluso con módulos y permiso de plataforma habilitados en la empresa de prueba | Interfaz y API; aprobado |
| Meta | Consultas locales de conexión, páginas, cuentas y formularios, sin sincronización ni OAuth real | API; aprobado para consultas locales |

Las comprobaciones cubren los recorridos indicados; no representan todas las
combinaciones posibles de filtros, dispositivos o condiciones de red.

## Cambios realizados a partir de las pruebas

- Interruptor `AUTOMATIZACIONES_CLIENTES_HABILITADAS`, apagado por defecto en el
  backend. La disponibilidad del bot requiere además los módulos y permisos de
  la empresa y una integración operativa. El cierre global no afecta la atención humana.
- La configuración del bot no aparece al cliente cuando el módulo está apagado
  o el cierre global está activo. Se ocultan también avisos innecesarios del bot
  en el panel de atención cuando está desactivado globalmente.
- `.env.development` y el archivo local `.env.production` tienen explícitamente
  `AUTOMATIZACIONES_CLIENTES_HABILITADAS=false`. Se conservaron respaldos privados
  de esos archivos en `.tmp/postgres-docker/`. Esto no cambia las variables del
  servidor de producción; al desplegar debe comprobarse allí el mismo valor.
- Tokens de refresco con identificador único y familia de sesión. La rotación y
  revocación se coordinan en PostgreSQL para permitir solicitudes paralelas y
  evitar que la ventana de gracia reactive una sesión cerrada. Se añadió la
  migración nullable `20261021140000_refresh_familia_sesion`, compatible con filas anteriores.
- Escaneo de Tailwind limitado a `app/` y `src/`, para que los archivos generados
  de compilación no produzcan clases CSS inválidas. Se habilitó un directorio
  de salida configurable para las compilaciones aisladas de QA.
  Referencia: [detección de clases de Tailwind](https://tailwindcss.com/docs/detecting-classes-in-source-files).
- Se incluyó en el cierre la migración adicional
  `20261021160000_whatsapp_salida_rechazada` y una comprobación real de su restricción en PostgreSQL.

## Base de datos y compilaciones

- **56 migraciones** aplicadas en `crm_gvr_dev` y en la copia restaurada
  `crm_gvr_rehearsal_20261021_test`. Repetir deploy no tiene pendientes.
- `prisma migrate diff` no detecta diferencias respecto al esquema del proyecto
  en ninguna de esas dos bases. Las restricciones SQL personalizadas se validan
  adicionalmente con las pruebas PostgreSQL.
- El respaldo del 09/10/2026 conserva sus 33 tablas originales: conteos y hashes
  de sus columnas originales coinciden antes y después. Permanecen 9 usuarios,
  1.054 leads, 939 chats y 10.567 mensajes; los 939 chats están en MANUAL.
- Build de producción del frontend: **aprobado**, incluidas TypeScript y generación de rutas.
- Generación aislada de Prisma, compilación Nest/webpack y TypeScript del backend: **aprobadas**.
- `npm run build` completo en la carpeta activa del backend: **pendiente** por
  `EPERM` al reemplazar `query_engine-windows.dll.node`. Se repitió después de
  detener la API de QA y persistió el bloqueo. No se detuvieron procesos ajenos
  a esta prueba. Repetir con el motor liberado o en el entorno limpio de despliegue.

## Entorno y evidencias

El frontend de QA usa `localhost:3100`; la API de QA usó `127.0.0.1:4100` y el
esquema `qa_flujos_20261021` de `crm_gvr_migration_test` en Docker, puerto 5433.
Se usaron únicamente datos y usuarios sintéticos para las acciones.
El almacenamiento externo se sustituyó por un proveedor de prueba y el ticker
de recordatorios estuvo apagado. La API temporal de QA se detuvo al terminar.

- [Resultados de las 58 comprobaciones API](../../outputs/qa-flujos-20261021/acciones-api.json).
- [Configuración del cliente sin Automatizaciones](../../outputs/qa-flujos-20261021/configuracion-cliente.png).
- [Empresa nueva con Automatizaciones inactivo](../../outputs/qa-flujos-20261021/empresa-modulos-inactivos.png).
- Pruebas permanentes: `src/auth/infrastructure/jwt-token.service.spec.ts`,
  `src/whatsapp/messaging/application/bot-empresa.service.spec.ts` y
  `test/whatsapp-control.integration-spec.ts`.
- Los scripts y fixtures de QA y los hashes del ensayo quedan en `.tmp/postgres-docker/`,
  privados y excluidos de Git. La base de ensayo del respaldo no se usó para iniciar la aplicación.

## Pendientes antes de producción

1. Repetir el build completo del backend sin el bloqueo de la DLL, o en un entorno limpio.
2. Obtener un respaldo reciente y ensayar las 56 migraciones contra el estado
   actual de producción; el respaldo ensayado es del 9 de octubre.
3. Validar con cuentas y destinatarios de prueba las integraciones reales:
   OAuth y sincronización de Meta, recepción por webhook, envío de texto,
   plantillas, reacciones y adjuntos de WhatsApp, llamadas/WebRTC, MinIO y Web Push.
   Las pruebas locales no certifican entregas, permisos del proveedor ni conectividad externa.
4. Para desplegar, mantener `AUTOMATIZACIONES_CLIENTES_HABILITADAS=false` en el
   servidor, aplicar migraciones antes de arrancar este backend y verificar salud,
   login, leads y chat manual. No habilitar el bot ni ejecutar `db push` o `migrate reset`.

**Producción no se ha publicado como parte de estas pruebas.**
