# Estado de producción — 21 de octubre de 2026

Se verificó la base de producción y se aplicó únicamente `20261021180000_modulo_grupos`, la única migración pendiente. La migración de gestión de usuarios ya estaba aplicada.

## Resultado

- Las 58 migraciones del repositorio están aplicadas; no hay ejecuciones fallidas sin resolver.
- Comparación Prisma entre producción y `prisma/schema.prisma`: `No difference detected`.
- 43 tablas, incluida `_prisma_migrations`.
- Permisos por empresa e identificadores de módulos conservados; LEADS hereda la habilitación de META_LEADS.
- Los conteos de las demás tablas se conservaron durante la verificación. Esto comprueba cantidad de registros, no identidad de todos sus valores.

## Organización de módulos

| Grupo | Módulos | Dependencias |
| --- | --- | --- |
| CRM | DASHBOARD, LEADS, INMUEBLES | Sin dependencias |
| Meta | META_LEADS, WHATSAPP, AUTOMATIZACIONES | META_LEADS y WHATSAPP requieren LEADS; AUTOMATIZACIONES requiere WHATSAPP |

CRM se renombró a INMUEBLES conservando su ID. Se creó el módulo LEADS y dos grupos.

## Tablas y registros verificados

| Tabla | Antes | Después |
| --- | ---: | ---: |
| _prisma_migrations | 59 | 60 |
| agenda_recordatorios_enviados | 8 | 8 |
| anuncios | 68 | 68 |
| automatizacion_integracion_eventos | 0 | 0 |
| automatizacion_integraciones | 0 | 0 |
| campanas | 20 | 20 |
| conjuntos_anuncios | 21 | 21 |
| inmuebles | 25 | 25 |
| lead_actividades | 5 | 5 |
| lead_auto_asignacion_config | 1 | 1 |
| lead_auto_asignacion_queue | 0 | 0 |
| lead_calificaciones | 4 | 4 |
| lead_estado_historial | 666 | 666 |
| lead_visitas | 1 | 1 |
| leads | 1201 | 1201 |
| meta_conexiones | 1 | 1 |
| meta_cuentas_publicitarias | 2 | 2 |
| meta_formularios | 11 | 11 |
| meta_insights_diarios | 238 | 238 |
| meta_paginas | 2 | 2 |
| meta_solicitudes_eliminacion_datos | 0 | 0 |
| modulo_grupos | Nueva | 2 |
| modulos | 5 | 6 |
| notificaciones | 3799 | 3799 |
| notificaciones_usuario | 5724 | 5724 |
| organizacion_modulos | 10 | 12 |
| organizacion_usuario_eventos | 0 | 0 |
| organizacion_usuarios | 10 | 10 |
| organizaciones | 2 | 2 |
| suscripciones_push | 116 | 116 |
| tokens_refresco | 1909 | 1909 |
| usuarios | 10 | 10 |
| whatsapp_bot_configuracion_eventos | 0 | 0 |
| whatsapp_bot_configuraciones | 0 | 0 |
| whatsapp_bot_preferencia_eventos | 0 | 0 |
| whatsapp_conexiones | 1 | 1 |
| whatsapp_control_eventos | 11 | 11 |
| whatsapp_conversaciones | 1090 | 1090 |
| whatsapp_llamadas | 1 | 1 |
| whatsapp_media_objetos | 361 | 361 |
| whatsapp_mensajes | 12644 | 12644 |
| whatsapp_mensajes_media | 4665 | 4665 |
| whatsapp_salida_intentos | 0 | 0 |

## Respaldo y despliegue

Respaldo privado anterior al cambio: `.tmp/produccion-modulos-20261021/produccion.dump`. Generado con pg_dump y su índice leído correctamente con pg_restore; no se hizo una restauración de ensayo. Los estados previo y posterior están en `antes.json` y `despues.json` dentro de esa carpeta ignorada por Git.

El usuario realizará manualmente el despliegue del backend y frontend locales compatibles con los códigos LEADS e INMUEBLES. No se desplegaron aplicaciones en esta operación.

Consulta posterior: 2026-10-21T22:16:55.014Z.
