# Copia de producción para desarrollo local

## Entorno Docker vigente desde el 21 de octubre de 2026

`.env.development` usa `crm_modulos_prod_20261021` en `127.0.0.1:5434`,
contenedor existente `gvr-postgres-local` (`postgres:17.6`). No se crearon
contenedores ni volúmenes. Producción solo se leyó mediante `pg_dump` y consultas
de integridad; `.env.production` no fue modificado.

Se restauraron las 42 tablas de producción, verificadas por conteo y huella de
contenido antes de migrar: 10 usuarios, 1 201 leads, 1 090 conversaciones y
12 632 mensajes. Se conservaron hashes de contraseña, sesiones, conexiones,
tokens y configuraciones. No se ejecutó el seed ni se cambiaron contraseñas de
usuarios. La contraseña del servidor Docker sigue siendo la existente; la
revisión automática rechazó cambiar la del administrador porque afectaría otras
bases del mismo servidor. La URL local utiliza esa credencial existente.

La clave `META_TOKEN_ENCRYPTION_KEY` de desarrollo coincide con la utilizada
para cifrar los datos copiados. Los demás controles del entorno de desarrollo
se conservan, incluido `AGENDA_INLINE_CRON=0`.

La migración `20261021180000_modulo_grupos` crea CRM/Meta, renombra el módulo
CRM a INMUEBLES conservando su ID y copia la habilitación de META_LEADS a LEADS.
No activa dependencias durante la migración: así conserva exactamente los
accesos anteriores. Los cambios posteriores de permisos sí aplican dependencias.
Al usar la aplicación pueden generarse o rotarse sesiones normalmente.

El respaldo privado, el entorno anterior y las huellas están en
`.tmp/postgres-docker/modulos/` (ignorado por Git). La base
`crm_modulos_validacion_20261021`, en el mismo servidor, se utilizó para validar
la migración sin actividad de la aplicación; contiene también datos sintéticos
de QA separados de la base de desarrollo.

```powershell
docker start gvr-postgres-local
npm run start:dev
```

Las secciones siguientes son antecedentes históricos; no describen la conexión
vigente. Para desarrollar usar `npm run start:dev`, que carga `.env.development`.

## Referencia del entorno anterior

Preparada el 9 de octubre de 2026. El origen se consultó y respaldó con `pg_dump` de solo lectura. No se aplicaron migraciones ni cambios en producción.

## Conexión

- Servidor: `127.0.0.1`, puerto `55432`, PostgreSQL 18.
- Base de trabajo: `crm_gvr_local_20261009`.
- Usuario local: `crm_local_admin`; contraseña generada guardada en los archivos locales ignorados por Git.
- `.env.development`: URL remota comentada, URL local activa. `.env.production` permanece intacto.
- Base separada de pruebas: `crm_gvr_control_test`. El arnés crea y elimina únicamente sus esquemas aleatorios de prueba.

Se usó el motor PostgreSQL ya instalado para crear una instancia aislada. El servicio existente en el puerto 5432 permanece sin cambios. La instancia del CRM está escuchando únicamente en loopback, no está registrada como servicio de Windows y se debe iniciar después de reiniciar el equipo:

```powershell
# Ejecutar desde back-saas-crm
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/postgres-local.ps1 start
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/postgres-local.ps1 status
# Para detener exclusivamente esta instancia:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/postgres-local.ps1 stop
```

No eliminar `.tmp/postgres-local/data`: contiene la base de trabajo. Los archivos locales se encuentran dentro del proyecto en OneDrive; no manipularlos ni intentar restaurar una sincronización mientras PostgreSQL esté ejecutándose. Para respaldar avances usar `pg_dump`, no copiar el directorio de datos de un servidor encendido.

## Restauración y migraciones

El respaldo está en `.tmp/produccion-copia-20261009/produccion.dump`, ignorado por Git. Contiene datos reales y debe conservarse como archivo privado. El entorno anterior está respaldado en esa misma carpeta. La copia representa el momento del respaldo: no se sincroniza con las nuevas operaciones de producción.

| Dato | Antes | Después de migrar |
| --- | ---: | ---: |
| Conversaciones | 939 | 939 |
| Mensajes | 10 567 | 10 567 |
| Leads | 1 054 | 1 054 |
| Usuarios | 9 | 9 |

Migraciones aplicadas únicamente en local:

- `20261007120000_whatsapp_control_humano`: aproximadamente 0,37 s de ejecución SQL.
- `20261009120000_whatsapp_bot_admin`: aproximadamente 0,013 s de ejecución SQL.
- `20261010000000_n8n_configuracion_plataforma`: conexión central y auditoría, aplicada únicamente en local, sin modificar usuarios, leads, mensajes ni atención.
- `20261009233000_bot_preferencias_empresa`: preferencias de atención por empresa e historial inmutable; aplicada después de los cambios anteriores el 9/10/2026, sin cambiar conteos ni modos de chat.

El comando completo de despliegue local tardó aproximadamente 2,53 s. Son tiempos de esta copia pequeña y sin carga; no garantizan tiempos ni disponibilidad en producción, que utiliza PostgreSQL 17.

El backfill inicial dejó los 939 chats en `MANUAL`; tras operaciones del usuario, la última migración conservó 938 MANUAL y uno HUMANO_ACTIVO. Los permisos del bot se administran en la copia desde Automatizaciones y no activan conversaciones por sí solos; el motor n8n sigue pendiente. El backfill clasificó 2 680 mensajes CUSTOMER, 427 HUMAN, 5 SYSTEM y dejó 7 455 UNKNOWN.

Las siete pruebas de integración PostgreSQL pasaron en la base local de pruebas, incluidas carreras entre procesos, control humano, restricciones y backfill. No enviaron mensajes reales.

## Aislamiento del entorno

Solo en la copia se desactivaron las conexiones Meta y WhatsApp, se retiraron sus tokens/secretos utilizables y se vaciaron las sesiones de refresco. No se eliminaron usuarios, leads, conversaciones ni mensajes. Los usuarios conservan sus contraseñas; para iniciar sesión en local deben autenticarse nuevamente.

El entorno de desarrollo utiliza claves JWT, webhook y cifrado propias; los recordatorios inline y Web Push están deshabilitados. No reconectar cuentas Meta reales ni reactivar envíos desde esta copia para pruebas de interfaz. La agenda de producción sigue funcionando.

## Almacenamiento online

Por indicación del usuario el 9 de octubre de 2026, `.env.development` reutiliza el endpoint, credenciales y bucket MinIO online de `.env.production`. PostgreSQL continúa en la copia local; `.env.production` no fue modificado. No se necesita MinIO local ni Docker para este flujo.

Los archivos multimedia no se copiaron: las referencias de la base local acceden a los objetos existentes en el almacenamiento online. El bucket se comparte con producción; las operaciones de escritura o eliminación desde desarrollo actúan sobre ese mismo almacenamiento. Las conexiones Meta/WhatsApp y el cron de agenda permanecen deshabilitados en la copia local.

Iniciar el backend con `npm run start:dev`. Si estaba en watch al cambiar el archivo de entorno, detenerlo y volver a ejecutar el comando para recargar las variables. `npm start` utiliza el entorno de producción y no debe usarse para trabajar con la copia local.
