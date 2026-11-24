# Historial HTTP en PostgreSQL

Solo backend. No hay pantalla ni endpoint de consulta. La tabla `registros_http`
permite al administrador seguir solicitudes directamente desde SQL. Complementa
Pino: los mensajes generales de arranque, tareas programadas y WebSocket siguen
en consola; esta tabla registra solicitudes HTTP, no todo el log del proceso.

## Datos

Una fila por solicitud finalizada o conexión abortada: fecha UTC de inicio,
UUID interno, request ID compartido con Pino y la respuesta, usuario, empresa y
sesión autenticados, IP, estado HTTP, duración y error. `solicitud` es JSONB con
método, ruta sin query string, ruta del endpoint, IP de conexión, user-agent y
content-type. No guarda cuerpos, mensajes de chat, archivos, respuestas, cookies,
Authorization ni parámetros de consulta. Los errores HTTP conservan el motivo
público; los errores internos conservan tipo y frames del stack, sin mensajes
arbitrarios que puedan contener SQL o credenciales.

Login y refresh exitosos se atribuyen al token recién emitido. Una solicitud
anónima o un login rechazado conserva usuario/empresa/sesión nulos. Un access
token antiguo no tiene sesión hasta su siguiente renovación o login. Los valores
de sesión nuevos coinciden con `tokens_refresco.familia_id`. Un 403 puede tener
identidad si el JWT fue validado antes del rechazo; un JWT inválido no se decodifica
para atribuirlo a una persona.

## Activación

1. Aplicar la migración `20261124000000_registros_http` con el procedimiento habitual
   de migración del proyecto (`prisma migrate deploy` usando DATABASE_URL correcta).
2. Compilar y desplegar el backend. No requiere cambios del frontend.
3. `HTTP_AUDIT_ENABLED` es `true` por defecto; `false` desactiva registro y limpieza.

La implementación local no aplica migraciones ni despliega producción por sí sola.
No recupera datos históricos anteriores a la activación.

## IP y proxies

Sin `TRUSTED_PROXY_CIDRS`, `ip` procede de la conexión directa. Si hay proxy,
configurar únicamente las IP/CIDR controladas, separadas por comas. Express resuelve
la cadena X-Forwarded-For desde esos proxies; no se confía indiscriminadamente en
cabeceras recibidas. El proxy debe sobrescribir las cabeceras de procedencia.

Si Next realiza la petición servidor a servidor y no reenvía la IP del navegador,
el backend solo ve la IP del servidor Next/proxy. Este cambio solo de backend no
puede reconstruir la IP original que no recibió. `solicitud.ipConexion` permite
distinguir el peer de la IP resuelta. User-agent y request ID son metadatos
aportados por el cliente, no pruebas de identidad; usuario y sesión proceden
del proceso de autenticación.

Referencia: [Express detrás de proxies](https://expressjs.com/en/guide/behind-proxies/).

## Retención y funcionamiento

Limpieza al arrancar y cada hora de filas con fecha anterior a 30 días exactos.
Cada ejecución borra hasta 20.000 filas en lotes de 1.000, bajo un lock transaccional
de PostgreSQL para coordinar réplicas. Si hay una acumulación mayor tras una parada,
se procesa en ejecuciones posteriores. El borrado es lógico en PostgreSQL: VACUUM
gestiona la reutilización del espacio; no elimina copias de seguridad externas.

Escritura por lotes de hasta 100 filas cada segundo, con cola máxima de 5.000.
Los fallos de BD se reintentan sin duplicar UUID y sin cambiar la respuesta de la
API. Si se llena la cola se descartan nuevas entradas y se emite aviso en consola.
Un apagado ordenado intenta drenar la cola; una caída abrupta puede perder filas
todavía en memoria. Es observabilidad de mejor esfuerzo, no un diario transaccional
de cambios de negocio. Requiere monitorear avisos de persistencia/cola llena.

## Consultas de seguimiento

Buscar una IP y resolver usuario y empresa:

```sql
SELECT r.fecha AT TIME ZONE 'America/Lima' AS fecha_lima,
       r.request_id, u.nombre, u.email, o.nombre AS empresa,
       r.sesion_id, r.ip, r.solicitud->>'metodo' AS metodo,
       r.solicitud->>'ruta' AS ruta, r.estado_http, r.duracion_ms,
       r.error_tipo, r.error_mensaje
FROM registros_http r
LEFT JOIN usuarios u ON u.id = r.usuario_id
LEFT JOIN organizaciones o ON o.id = r.organizacion_id
WHERE r.ip IN ('38.56.219.133', '::ffff:38.56.219.133')
ORDER BY r.fecha DESC LIMIT 200;
```

Seguir una solicitud (el ID se devuelve en `x-request-id`):

```sql
SELECT * FROM registros_http
WHERE request_id = 'ID_DE_SOLICITUD'
ORDER BY fecha DESC LIMIT 100;
```

Errores de una empresa durante las últimas 24 horas:

```sql
SELECT fecha, usuario_id, sesion_id, request_id, solicitud,
       estado_http, error_tipo, error_mensaje, error_stack
FROM registros_http
WHERE organizacion_id = 'UUID_EMPRESA'::uuid
  AND fecha >= now() - interval '24 hours'
  AND estado_http >= 400
ORDER BY fecha DESC LIMIT 200;
```
