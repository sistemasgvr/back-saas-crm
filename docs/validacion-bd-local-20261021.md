# Validación local de migraciones — 21 de octubre de 2026

## Resultado

Actualización al cierre de pruebas: **56 migraciones**, 193 pruebas de backend,
10 de integración y 58 comprobaciones API aprobadas. El alcance visual, los
hallazgos corregidos y los pendientes de producción están en
[cierre de validación de flujos](validacion-flujos-20261021.md).
El detalle siguiente corresponde al primer ensayo de migraciones.

54 migraciones aplicadas en Docker. El esquema de PostgreSQL coincide con
`prisma/schema.prisma` tanto en la base nueva como en la copia restaurada.
La repetición de `prisma migrate deploy` termina sin migraciones pendientes.
No se accedió ni se aplicaron cambios a producción.

## Entorno y datos

- Contenedor `crm-postgres-dev`, imagen `postgres:17.6`, puerto `127.0.0.1:5433`.
- Volumen persistente `crm-postgres-dev-data`.
- `.env.development` apunta a `crm_gvr_dev`: base nueva con las tablas migradas.
- `crm_gvr_migration_test`: esquemas aleatorios para pruebas, eliminados al terminar.
- `crm_gvr_rehearsal_20261021_test`: copia separada del respaldo local del
  9 de octubre de 2026, obtenido entonces de PostgreSQL 17.11.
- El entorno de desarrollo no apunta a la copia de ensayo. Esta conserva datos
  y credenciales históricos y no se usó para iniciar la aplicación ni enviar mensajes.
- Respaldo y resultados privados en `.tmp/`, excluidos de Git.

## Correcciones encontradas durante el ensayo

1. Se declararon en Prisma las relaciones y acciones referenciales que ya
   existían en SQL para control humano, configuración del bot y automatizaciones.
   Se alinearon también nombres de índices, valores por defecto de fechas y la
   restricción de borrado de objetos multimedia. No se eliminaron restricciones.
2. Nueva migración `20261021120000_alinear_esquema_indices_defaults`: índice
   `meta_conexiones_meta_user_id_idx` y default `n8n` del identificador de integración.
3. Nueva migración `20261021123000_conservar_columnas_legacy_whatsapp`: conserva
   `business_id`, `origen`, `token_cifrado` y `token_expira_en`, presentes en el
   respaldo pero ausentes del historial de migraciones. Se crean si no existen
   para que una instalación nueva tenga el mismo esquema. Están marcadas
   `@ignore` para no exponerlas mediante Prisma Client. Sus valores no se modifican.

Ambas migraciones nuevas usan transacción y límites de espera por bloqueo y ejecución.
Las migraciones anteriores no se editaron.

## Conservación de información

Se compararon conteos y hashes del contenido de las columnas originales de
las 33 tablas de aplicación existentes, antes y después del conjunto de cambios.
Todas conservaron su contenido. Se excluyó `_prisma_migrations`, que cambia al desplegar.

| Datos | Antes | Después |
| --- | ---: | ---: |
| Usuarios | 9 | 9 |
| Leads | 1.054 | 1.054 |
| Conversaciones | 939 | 939 |
| Mensajes | 10.567 | 10.567 |

Los 939 chats quedaron en `MANUAL`. La columna nueva de autoría clasificó
2.680 mensajes CUSTOMER, 427 HUMAN y 5 SYSTEM, y conservó 7.455 UNKNOWN.
La ejecución local de las primeras cinco migraciones pendientes tardó aproximadamente
0,94 s y la última aproximadamente 0,74 s, incluido el arranque de Prisma CLI.
Estos tiempos corresponden al respaldo de octubre y no estiman bloqueos en producción.

## Pruebas

- 22 suites de backend: **188 pruebas aprobadas**.
- Integración PostgreSQL: **9 pruebas aprobadas**. Incluyen bloqueo entre procesos,
  carreras de control humano, restricciones por organización, auditoría inmutable,
  conservación de chats anteriores y conversaciones del mismo contacto en distintas líneas.
- Se añadieron 1.004 mensajes sintéticos previos a las migraciones para ejercitar
  varias vueltas del backfill; contenido, fechas y demás columnas originales se conservaron.
- La prueba HTTP inicia el módulo real con PostgreSQL, valida health, rechazo sin
  autenticación, credenciales inválidas, login, perfil, consulta de leads, chats,
  control de atención y persistencia del refresh token.
- En el smoke HTTP se sustituye el almacenamiento por un proveedor de prueba y
  se deshabilita el ticker de agenda. No se invocan Meta, n8n ni el bucket online.
- `prisma validate` y `tsc --noEmit --incremental false`: aprobados.
- Generación del cliente Prisma en un directorio aislado: aprobada.
- Compilación Nest/webpack: aprobada.
- Formato de la prueba y `git diff --check`: aprobados.

El comando completo `npm run build` en la carpeta activa encuentra `EPERM` al
reemplazar `query_engine-windows.dll.node`, que está en uso. La generación aislada
y la compilación se verificaron por separado. Queda repetir el comando completo
con los procesos que utilizan ese cliente detenidos.

## Antes de producción

El ensayo valida este código contra una base vacía, datos sintéticos y el respaldo
del **9 de octubre**. Aún no certifica el estado actual de producción.

1. Obtener un respaldo reciente y comprobar el historial y el esquema actuales.
   Ensayar ese respaldo con este mismo conjunto de migraciones, comprobando nuevamente
   conteos, contenido y ausencia de diferencias. No usar `db push` ni `migrate reset`.
2. Repetir `npm run build` sin el bloqueo local de la DLL o en el entorno de despliegue.
3. Revisar en la interfaz los flujos usados por el equipo: login, leads, agenda,
   inmuebles, chats y permisos. Los envíos reales y multimedia online no están cubiertos
   por estas pruebas aisladas.
4. Desplegar conjuntamente código y migraciones mediante `prisma migrate deploy`
   con un procedimiento de respaldo/restauración y una ventana acordada; comprobar
   salud y flujos principales. El bot no se habilita por estas migraciones.

No se ejecutó ningún despliegue de producción en esta validación.
