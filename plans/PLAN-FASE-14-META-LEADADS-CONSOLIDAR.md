# Plan — Fase 14: Consolidar Lead Ads (Oleada A)

Documento **independiente** del [PLAN.md](./PLAN.md). Extiende el MVP + Fase 13 para cerrar huecos del núcleo Lead Ads.

**Origen:** [INVESTIGACION-META-API.md](./INVESTIGACION-META-API.md) §7 Oleada A  
**Repos:** `back-saas-crm` · `front-saas-crm`  
**Prerrequisitos:** Fases 7–11 ✅ · Fase 13 (multi-origen) implementada  
**Módulo:** `META_LEADS` (sin módulo nuevo en catálogo)

---

## 1. Objetivo

Entregar cuatro capacidades concretas:

1. **Catálogo** de formularios leadgen por página vinculada (nombres reales, no solo IDs).  
2. **Backfill / reimport** de leads por formulario y/o rango de fechas (idempotente).  
3. **Alertas de salud** del webhook (página sin suscripción / errores Graph).  
4. **Una sola versión Graph** parametrizada (hoy hardcode `v21.0` → versión documentada actual).

---

## 2. Inventario: ya existe vs falta

Leyenda: `[x]` ya en código / otro plan y desarrollado · `[ ]` pendiente en esta fase.

### 2.1 Base multi-origen y Lead Ads (Fase 13 + MVP)

| Ítem | Estado | Dónde |
|------|--------|--------|
| OAuth + App por org + tokens cifrados | [x] | `meta/connections` |
| Scopes `pages_show_list`, `pages_manage_metadata`, `leads_retrieval`, `ads_read` | [x] | `obtener-url-oauth.use-case.ts` |
| N páginas vinculadas (`meta_paginas`) | [x] | Fase 13 |
| Suscripción `leadgen` al vincular página | [x] | `vincular-pagina.use-case.ts` |
| Campos `webhookSuscrito` / `webhookSuscritoEn` | [x] | schema + repo |
| Re-suscribir webhook (API + UI perfil) | [x] | `POST .../resync-webhook`, `MetaPageProfileView` |
| Badge webhook en listado/perfil | [x] | `MetaWebhookBadge` |
| Webhook público verify + HMAC + enrutado por `page_id` | [x] | `meta/webhooks` → `meta_paginas` |
| Fetch lead `/{leadgen_id}` e ingest | [x] | `ProcesarLeadEntranteUseCase` |
| Upsert idempotente `(organizacion_id, id_externo)` | [x] | `leads` unique |
| Guardar `formulario_id` (ID Meta string) en lead | [x] | schema `Lead.formularioId` |
| Filtro leads por `formularioId` (texto libre) | [x] | API + `LeadsView` input text |
| Filtro leads por `metaPaginaId` | [x] | Fase 13.6 |
| Notificaciones in-app + WebSocket | [x] | `notifications/` |
| Sync jerarquía campañas/ads (manual) | [x] | cuentas publicitarias |
| Hub UI `/settings/meta` + perfiles | [x] | front settings/meta |

### 2.2 Oleada A — pendiente (esta fase)

| Ítem | Estado |
|------|--------|
| Tabla / catálogo `meta_formularios` (nombre, status, page FK) | [ ] |
| Graph `GET /{page-id}/leadgen_forms` (+ detalle form) | [ ] |
| Sync formularios por página (manual on-demand) | [ ] |
| Filtro leads: select searchable por **nombre** de form | [ ] |
| UI lista forms en perfil de página | [ ] |
| Backfill `GET /{form-id}/leads` con filtering por fecha | [ ] |
| Endpoint + UI “Reimportar leads” | [ ] |
| Reutilizar ingest idempotente en backfill | [ ] parcial: ingest existe; falta orquestador bulk |
| Health check vs Graph `subscribed_apps` (no solo flag local) | [ ] |
| Notificación automática “webhook caído / error Graph” | [ ] |
| Job/cron ligero de salud (sin Redis) | [ ] |
| `META_GRAPH_VERSION` único (OAuth + Graph client) | [ ] hoy: `v21.0` duplicado |

### 2.3 Explícitamente fuera de Fase 14

| Ítem | Motivo |
|------|--------|
| Insights / CPL / spend | Oleada B |
| CAPI Conversion Leads | Oleada C |
| Crear/archivar forms en Meta | P2 investigación |
| WhatsApp / Messenger | Oleada D |
| Redis / BullMQ | PLAN.md §11; backfill sync con límites |
| Ads management (pausar campañas) | Oleada E |

---

## 3. Modelo de datos

### 3.1 Nueva tabla `meta_formularios`

| Columna | Tipo | Notas |
|---------|------|--------|
| `id` | UUID PK | |
| `organizacion_id` | UUID FK | |
| `meta_pagina_id` | UUID FK | Página vinculada dueña del form |
| `form_id` | VARCHAR(64) | ID Meta del leadgen form |
| `nombre` | VARCHAR(200) | |
| `estado_meta` | VARCHAR(40) NULL | ACTIVE / ARCHIVED si Graph lo da |
| `locale` | VARCHAR(20) NULL | Opcional |
| `ultimo_sync_en` | TIMESTAMPTZ NULL | |
| Auditoría estándar | | `estado`, `usuario_*`, `fecha_*` |

**Índices / reglas:**

- `UNIQUE (organizacion_id, form_id)` WHERE `estado = 1`
- `INDEX (meta_pagina_id)`
- Soft delete al desvincular página (cascade lógico: `estado = 0`) o borrar soft los forms de esa página

### 3.2 Cambios opcionales en `meta_paginas`

| Columna | Tipo | Notas |
|---------|------|--------|
| `webhook_ultimo_check_en` | TIMESTAMPTZ NULL | Último health check Graph |
| `webhook_ultimo_error` | TEXT NULL | Mensaje Graph truncado |
| `formularios_ultimo_sync_en` | TIMESTAMPTZ NULL | Opcional; o solo en forms |

### 3.3 Leads

- **Sin cambio de schema obligatorio:** seguir guardando `formulario_id` (Meta ID string).  
- El filtro UI resolverá `form_id` → nombre vía `meta_formularios`.  
- Opcional futuro (no Fase 14): FK `meta_formulario_id` UUID.

### 3.4 Notificaciones

Reutilizar `CrearNotificacionUseCase` con tipos nuevos (string libre o enum documentado):

| `tipo` | Cuándo |
|--------|--------|
| `META_WEBHOOK_SALUD` | Página sin `leadgen` en Graph o flag local `webhookSuscrito = 0` tras check |
| `META_GRAPH_ERROR` | Error persistente al sync forms / backfill / resuscribir |

Payload sugerido: `{ metaPaginaId, pageId, nombre, codigo?, detalle? }` + deep link `/settings/meta/pages/{id}`.

---

## 4. Graph API (contrato)

### 4.1 Versión unificada

| Hoy | Objetivo |
|-----|----------|
| `v21.0` en `meta-graph.client.ts` y OAuth dialog | Una sola fuente: env `META_GRAPH_VERSION` default **`v25.0`** (docs Lead Ads / Insights recientes) |

Usos:

- `https://graph.facebook.com/{META_GRAPH_VERSION}/...`
- `https://www.facebook.com/{META_GRAPH_VERSION}/dialog/oauth?...`

Constantes locales `GRAPH_VERSION` / `GRAPH_BASE_URL` **eliminadas**; leer de `ConfigService` (o helper `MetaGraphConfig` en shared/meta).

**Done versión:** un solo string configurable; build OK; OAuth + un GET Graph de smoke pasan.

### 4.2 Formularios

```
GET /{page-id}/leadgen_forms
  ?fields=id,name,status,locale,created_time
  &access_token={page_token}
```

Paginación cursor estándar Graph.

### 4.3 Backfill leads

```
GET /{form-id}/leads
  ?fields=created_time,id,ad_id,adset_id,campaign_id,form_id,field_data
  &filtering=[{"field":"time_created","operator":"GREATER_THAN","value":{unix}}]
  &filtering+= LESS_THAN si hay hasta
  &limit=25|50
```

Por cada lead:

1. Llamar la **misma lógica** que el webhook (`ProcesarLeadEntranteUseCase` con `pageId` + `leadgenId`), **o** extraer un `IngestarLeadMetaUseCase` compartido.  
2. No duplicar filas (unique ya existe).  
3. Contar: `importados` / `yaExistian` / `errores`.

Límites Fase 14 (sin cola):

- Máx. **N páginas Graph** por request (ej. 10 × 50 = 500 leads) o timeout HTTP configurable.  
- Si hay más: respuesta `{ incompleto: true, nextCursor }` y botón “Continuar” en UI.  
- Rate limit: backoff simple ante `429`.

### 4.4 Salud webhook

```
GET /{page-id}/subscribed_apps?access_token={page_token}
```

Verificar que la app de la org está suscrita al field `leadgen` (o que `subscribed_fields` lo incluye).  
Si no: marcar `webhookSuscrito = 0`, guardar error, notificar.

Alternativa complementaria (ya existe): `POST .../resync-webhook` — [x].

---

## 5. Backend (clean architecture)

Estructura sugerida (reutilizar módulos):

```
src/meta/
  forms/                    # NUEVO submódulo
    application/use-cases/
      sincronizar-formularios-pagina.use-case.ts
      listar-formularios.use-case.ts
    ...
  leads/
    application/use-cases/
      backfill-leads-formulario.use-case.ts   # NUEVO
      procesar-lead-entrante.use-case.ts      # [x] reutilizar
  pages/
    application/use-cases/
      verificar-salud-webhook-pagina.use-case.ts  # NUEVO
      resuscribir-webhook-pagina.use-case.ts      # [x]
  connections/infrastructure/
    meta-graph.client.ts   # ampliar + versión unificada
```

### 5.1 Ampliar `MetaGraphClient` (port)

| Método | Estado |
|--------|--------|
| `obtenerLead`, `suscribirPaginaLeadgen`, … | [x] |
| `listarLeadgenForms(pageId, pageToken)` | [ ] |
| `listarLeadsDeForm(formId, pageToken, filtro)` | [ ] |
| `obtenerAppsSuscritas(pageId, pageToken)` | [ ] |

### 5.2 Endpoints HTTP (propuesta)

| Método | Path | Rol | Descripción |
|--------|------|-----|-------------|
| GET | `/meta/pages/:id/forms` | PROPIETARIO/ADMIN + META_LEADS | Lista forms syncados (BD) |
| POST | `/meta/pages/:id/forms/sync` | idem | Pull Graph → upsert `meta_formularios` |
| GET | `/meta/forms` | idem | Lista org (filtros leads): `?metaPaginaId=` |
| POST | `/meta/pages/:id/forms/:formId/backfill` | idem | Body: `{ desde?, hasta?, cursor? }` |
| POST | `/meta/pages/:id/health-check` | idem | Verifica subscribed_apps + actualiza flags |
| POST | `/meta/pages/:id/resync-webhook` | idem | [x] ya existe |

Cron opcional (Nest `@Cron` o endpoint interno admin):

- Cada X horas: `health-check` de páginas activas con `webhookSuscrito = 1` o todas activas.  
- Sin Redis; si Vercel serverless limita cron, documentar alternativa: health al abrir perfil + botón “Verificar”.

---

## 6. Frontend

### 6.1 Perfil de página (`/settings/meta/pages/[id]`) — [x] base existe

Añadir sección **Formularios**:

- Botón “Sincronizar formularios”.  
- Tabla: nombre, form_id, estado Meta, última sync.  
- Acción por fila: “Reimportar leads” → modal fechas (desde/hasta) + progreso (importados / existentes / errores).

Sección **Salud webhook** — [x] parcial:

- Badge + re-suscribir: [x]  
- Botón “Verificar en Meta” (health-check Graph): [ ]  
- Mostrar `webhook_ultimo_error` / `webhook_ultimo_check_en`: [ ]

### 6.2 Leads — filtros

| Hoy | Fase 14 |
|-----|---------|
| `formularioId` input texto | Select searchable con options desde `GET /meta/forms` (label = nombre, value = form_id) |
| Página select | [x] Fase 13 |

### 6.3 Notificaciones

- Campana existente: [x]  
- Render tipos `META_WEBHOOK_SALUD` / `META_GRAPH_ERROR` con link al perfil: [ ]

---

## 7. Subfases de implementación

Cada subfase: `npm run build` en back y front tocados.

### Fase 14.0 — Graph version unificada

- [ ] `META_GRAPH_VERSION` en `.env.example` / `.env.production` (default `v25.0`).  
- [ ] Helper único usado por OAuth + `AxiosMetaGraphClient`.  
- [ ] Smoke: URL OAuth + `listarPaginas` / un GET simple.

**Done cuando:** no queda literal `v21.0` en src Meta.

### Fase 14.1 — Schema formularios + Graph list forms

- [ ] Migración `meta_formularios` (+ columnas salud opcionales en `meta_paginas`).  
- [ ] Port/client: `listarLeadgenForms`.  
- [ ] Use case sync + listar.  
- [ ] Endpoints `GET/POST .../forms`.

**Done cuando:** tras sync, una página real muestra ≥1 form con nombre en API.

### Fase 14.2 — Frontend catálogo forms + filtro leads

- [ ] Sección forms en perfil página.  
- [ ] `DynamicFilters` leads: select searchable de forms (y mantener página).  
- [ ] Queries/actions front.

**Done cuando:** usuario filtra leads por nombre de formulario.

### Fase 14.3 — Backfill / reimport

- [ ] Client `listarLeadsDeForm` + filtering fechas.  
- [ ] Use case backfill → reutiliza ingest idempotente.  
- [ ] Endpoint + UI modal con resumen.  
- [ ] Límites de página / cursor documentados en respuesta.

**Done cuando:** reimportar un form en rango no duplica leads; aparecen los faltantes.

### Fase 14.4 — Salud webhook + alertas

- [ ] `obtenerAppsSuscritas` + use case health-check.  
- [ ] Actualizar `webhookSuscrito` / error / timestamp.  
- [ ] Notificación a PROPIETARIO/ADMIN de la org si falla.  
- [ ] UI “Verificar en Meta” + mostrar último error.  
- [ ] (Opcional) cron Nest diario o instrucción ops de hit manual.

**Done cuando:** desuscribir a mano en Meta + health-check marca badge en error y genera notificación.

---

## 8. Criterios de cierre (Fase 14 completa)

- [ ] Versión Graph única vía env; sin `v21.0` hardcode.  
- [ ] Cada página vinculada puede **sincronizar** su catálogo `leadgen_forms`.  
- [ ] `/leads` filtra por formulario con **nombre** (no solo pegar ID).  
- [ ] Backfill por form + rango es **idempotente** y reporta conteos.  
- [ ] Health-check compara estado real en Meta; alerta in-app si falla.  
- [ ] Re-suscribir sigue funcionando ([x] previo).  
- [ ] Sin Redis/BullMQ; límites de backfill documentados.  
- [ ] `INVESTIGACION-META-API.md` Oleada A marcada como planificada/en curso vía este doc.

---

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Rate limit al backfill grande | Páginas pequeñas + cursor + backoff; no sync automático masivo |
| Permisos: forms requieren page token válido | Reusar token página cifrado; si falla, pedir re-OAuth / resuscribir |
| `leads_retrieval` sin Advanced Access en Live | Documentar App Review; error claro en UI |
| Cambio `v21` → `v25` rompe campos | Probar OAuth + leadgen + list forms en sandbox antes de prod |
| Cron en serverless (Vercel) | Preferir health on-demand + botón; cron solo si el host lo soporta |
| Forms archivados | Sync con status; filtro leads solo ACTIVE por defecto opcional |

---

## 10. Orden de trabajo recomendado

```
14.0 Versión Graph
  → 14.1 Schema + sync forms (API)
    → 14.2 UI catálogo + filtro leads
      → 14.3 Backfill
        → 14.4 Salud + notificaciones
```

14.0 puede ir en paralelo con 14.1 (mismo PR o PR previo corto).

---

## 11. Referencias

- [INVESTIGACION-META-API.md](./INVESTIGACION-META-API.md) — Oleada A  
- [PLAN-FASE-13-META-MULTI.md](./PLAN-FASE-13-META-MULTI.md) — páginas N, perfiles, filtros  
- [PLAN.md](./PLAN.md) §8 Lead Ads / webhook · §11 post-MVP  
- [Retrieving Leads](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/)  
- [Lead Forms](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/create/)  
- Graph: `/{page-id}/leadgen_forms`, `/{form-id}/leads`, `/{page-id}/subscribed_apps`

---

**Siguiente paso concreto:** implementar **Fase 14.0** (versión Graph unificada) y enseguida **14.1** (migración + sync forms) en una rama dedicada.
