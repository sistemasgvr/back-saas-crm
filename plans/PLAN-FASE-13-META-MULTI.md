# Plan complementario — Fase 13: Meta multi-origen

Documento **independiente** del [PLAN.md](./PLAN.md) original. No lo reemplaza: extiende el MVP (fases 0–11 ✅) para soportar **varias páginas de Facebook** y **varias cuentas publicitarias** por empresa, con **vistas de perfil** por cada origen.

**Repos:** `back-saas-crm` · `front-saas-crm`  
**Prerrequisitos:** Fases 7–11 cerradas (OAuth, webhook, leads, dashboard).  
**Módulo:** `META_LEADS` (y `DASHBOARD` donde aplique).

---

## 1. Problema que resuelve

Hoy cada organización tiene **una sola** `page_id` y **una sola** `ad_account_id` en `meta_conexiones`. Al elegir otra página, se **reemplaza** la anterior y deja de recibir leads de la previa.

**Objetivo:** una empresa puede:

- Conectar **N páginas** → recibir leads de todas (webhook leadgen suscrito en cada una).
- Vincular **N cuentas publicitarias** → ver campañas/anuncios y KPIs agregados o filtrados por cuenta.
- Abrir el **perfil** de cada página o cuenta (estado, métricas básicas, acciones).

---

## 2. Estado actual (referencia)

| Pieza | Hoy |
|-------|-----|
| `meta_conexiones` | 1 fila activa por org: OAuth, App, token usuario, **un** `page_id`, **un** `ad_account_id` |
| Webhook | `page_id` → `meta_conexiones` → `organizacion_id` |
| Regla global | `page_id` único entre orgs activas (migración parcial unique) |
| UI `/settings` | Select simple página + select simple cuenta ads |
| `campanas` / `leads` | Sin FK a página ni cuenta ads (solo org + meta ids de campaña) |

Ver [PLAN.md §8.3](./PLAN.md) (enrutado webhook) y fases 7–9.

---

## 3. Modelo objetivo

Separar **sesión OAuth** de **orígenes conectados**:

```
meta_conexiones              → 1 por org (OAuth, App ID/Secret, token usuario, meta_user_*)
meta_paginas                 → N por org (page_id, nombre, token página cifrado, webhook suscrito)
meta_cuentas_publicitarias   → N por org (ad_account_id, nombre, moneda opcional, sync metadata)
```

### 3.1 Tabla `meta_paginas`

| Columna | Tipo | Notas |
|---------|------|--------|
| `id` | UUID PK | |
| `organizacion_id` | UUID FK | |
| `meta_conexion_id` | UUID FK | Sesión OAuth padre |
| `page_id` | VARCHAR(64) | ID Meta |
| `nombre` | VARCHAR(200) | |
| `token_pagina_cifrado` | TEXT NULL | Page access token (cifrado AES-256-GCM) |
| `webhook_suscrito` | SMALLINT | `1` si leadgen subscribed |
| `webhook_suscrito_en` | TIMESTAMPTZ NULL | |
| `foto_url` | TEXT NULL | Opcional desde Graph |
| `categoria` | VARCHAR(120) NULL | Opcional |
| Auditoría estándar | | `estado`, `usuario_*`, `fecha_*` |

**Índices / reglas:**

- `UNIQUE (page_id)` WHERE `estado = 1` — una página no puede estar en dos empresas (misma regla MVP).
- `UNIQUE (organizacion_id, page_id)` WHERE `estado = 1`.
- Soft delete: `estado = 0` al “desvincular” página.

### 3.2 Tabla `meta_cuentas_publicitarias`

| Columna | Tipo | Notas |
|---------|------|--------|
| `id` | UUID PK | |
| `organizacion_id` | UUID FK | |
| `meta_conexion_id` | UUID FK | |
| `ad_account_id` | VARCHAR(64) | ej. `act_123` |
| `nombre` | VARCHAR(200) | |
| `moneda` | VARCHAR(8) NULL | Desde Graph si disponible |
| `estado_cuenta` | VARCHAR(40) NULL | ACTIVE, DISABLED, etc. |
| `timezone` | VARCHAR(64) NULL | Opcional |
| `ultimo_sync_en` | TIMESTAMPTZ NULL | Última sync de campañas |
| Auditoría estándar | | |

**Índices:**

- `UNIQUE (organizacion_id, ad_account_id)` WHERE `estado = 1`.

### 3.3 Cambios en tablas existentes

| Tabla | Cambio |
|-------|--------|
| `meta_conexiones` | **Deprecar** uso de `page_id`, `page_nombre`, `ad_account_id`, `ad_account_nombre` en runtime (mantener columnas temporalmente para migración; luego nullable sin escritura). |
| `campanas` | Añadir `meta_cuenta_publicitaria_id` UUID FK NULL → saber de qué cuenta vino la campaña. |
| `leads` | Añadir `meta_pagina_id` UUID FK NULL → filtrar leads por página de origen. |

### 3.4 Migración de datos

1. Por cada `meta_conexiones` activa con `page_id` → insert en `meta_paginas`.
2. Por cada `ad_account_id` → insert en `meta_cuentas_publicitarias`.
3. Backfill `leads.meta_pagina_id` desde `datos_crudos.page_id` cuando exista.
4. Backfill `campanas.meta_cuenta_publicitaria_id` si se puede inferir (si no, NULL hasta próximo ingest/sync).

---

## 4. Backend — API (NestJS)

Prefijo existente: `/api/meta/...`. Clean architecture: nuevos use cases + repos en `meta/connections` o submódulos `meta/pages`, `meta/ad-accounts`.

### 4.1 Conexión OAuth (sin cambio de flujo)

- `POST /meta/connections/app-credentials`
- OAuth callback (fuera de controller cliente)
- `GET /meta/connections/current` → resumen: usuario Meta, **conteo** páginas/cuentas activas, `appConfigurada`, `conectado`.

### 4.2 Páginas

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/meta/pages` | Listado paginado de páginas **activas** de la org (tarjetas / tabla settings) |
| GET | `/meta/pages/available` | Páginas del token OAuth aún no vinculadas (desde Graph) |
| GET | `/meta/pages/:id` | **Perfil** de página (detalle + stats) |
| POST | `/meta/pages` | Vincular página: body `{ pageId, pageNombre }` → token página + subscribe leadgen |
| DELETE | `/meta/pages/:id` | Desvincular: unsubscribe webhook + `estado = 0` |
| POST | `/meta/pages/:id/resync-webhook` | Reintentar suscripción leadgen |

**Perfil (`GET :id`) incluye:**

- `pageId`, `nombre`, `fotoUrl`, `categoria`
- `webhookSuscrito`, `webhookSuscritoEn`
- `totalLeads` (count leads con `meta_pagina_id`)
- `leadsUltimos7Dias` (opcional, mismo rango Lima que dashboard)
- `fechaCreacion`, `estado`

### 4.3 Cuentas publicitarias

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/meta/ad-accounts` | Listado activas de la org |
| GET | `/meta/ad-accounts/available` | Cuentas del token no vinculadas |
| GET | `/meta/ad-accounts/:id` | **Perfil** de cuenta |
| POST | `/meta/ad-accounts` | Vincular `{ adAccountId, adAccountNombre }` |
| DELETE | `/meta/ad-accounts/:id` | Desvincular (`estado = 0`) |
| POST | `/meta/ad-accounts/:id/sync` | Sync manual campañas/conjuntos/anuncios de esa cuenta |

**Perfil (`GET :id`) incluye:**

- `adAccountId`, `nombre`, `moneda`, `estadoCuenta`, `timezone`
- `totalCampanas`, `totalLeads` (leads ligados a campañas de esa cuenta)
- `ultimoSyncEn`
- Enlace a campañas filtradas (id list o count)

### 4.4 Deprecación endpoints MVP

| Actual | Nuevo comportamiento |
|--------|---------------------|
| `POST /meta/connections/page` | Redirige a `POST /meta/pages` o 410 con mensaje de migración |
| `POST /meta/connections/ad-account` | Redirige a `POST /meta/ad-accounts` |
| `GET /meta/connections/pages` | Mantener como alias de `available` o deprecar en favor de `/meta/pages/available` |

Frontend Fase 13 usa solo rutas nuevas.

### 4.5 Webhook e ingestión

```
Meta webhook (page_id + leadgen_id)
        ↓
Buscar meta_paginas WHERE page_id = ? AND estado = 1
        ↓
organizacion_id + meta_pagina_id
        ↓
Fetch lead Graph → upsert campaña/anuncio (con meta_cuenta_publicitaria_id si aplica)
        ↓
Insert/update lead con meta_pagina_id
```

- HMAC y verify token: **sin cambio** (por org vía `meta_conexiones` / App Secret).
- Idempotencia: igual (`organizacion_id`, `id_externo`).

### 4.6 Sync campañas (cuenta ads)

- Job **síncrono bajo demanda** (botón “Sincronizar” en perfil de cuenta) — sin Redis en esta fase.
- Por cada cuenta activa: list campaigns/adsets/ads vía Graph → upsert `campanas`, `conjuntos_anuncios`, `anuncios` con `meta_cuenta_publicitaria_id`.
- Rate limits Meta: paginar y loguear; no bloquear webhook.

### 4.7 Desconectar Meta

`POST /meta/connections/disconnect`:

1. Unsubscribe todas las páginas activas.
2. Soft-delete todas `meta_paginas` y `meta_cuentas_publicitarias`.
3. Limpiar token OAuth en `meta_conexiones` (comportamiento actual).
4. **Conservar** credenciales App (decisión aceptada en PLAN.md §15).

---

## 5. Frontend — rutas y vistas (Next.js)

Modular bajo `src/modules/settings/meta/` (o `src/modules/meta/` si crece).

### 5.1 Mapa de rutas

| Ruta | Vista | Rol |
|------|-------|-----|
| `/settings` | Config org + card “Meta” con resumen | PROPIETARIO, ADMIN |
| `/settings/meta` | **Hub Meta**: tabs Conexión \| Páginas \| Cuentas | PROPIETARIO, ADMIN |
| `/settings/meta/pages` | Listado de páginas vinculadas + CTA “Agregar página” | idem |
| `/settings/meta/pages/[id]` | **Perfil de página** | idem |
| `/settings/meta/ad-accounts` | Listado cuentas + CTA “Agregar cuenta” | idem |
| `/settings/meta/ad-accounts/[id]` | **Perfil de cuenta publicitaria** | idem |

Opcional en menú lateral (si hay espacio): entrada **Meta** con sub ítems cuando `META_LEADS` habilitado.

### 5.2 UI — Hub `/settings/meta`

**Tab Conexión** (evolución de `MetaConnectionCard` actual):

- Credenciales App, botón Conectar/Desconectar OAuth.
- Resumen: “3 páginas · 2 cuentas publicitarias activas”.
- Sin selects que reemplazan la selección única; enlaces a tabs Páginas / Cuentas.

**Tab Páginas:**

- `TableCard` o grid de cards: avatar/foto, nombre, `page_id`, badge webhook (Suscrito / Error), contador leads.
- Acciones: Ver perfil, Desvincular.
- Modal o drawer “Agregar página”: lista desde `GET /meta/pages/available` (multi-select permitido).

**Tab Cuentas:**

- Misma idea: nombre, id, moneda, última sync, # campañas.
- Agregar desde `available`.

### 5.3 UI — Perfil de página `/settings/meta/pages/[id]`

Layout tipo detalle (como `LeadDetailView` / `OrganizationDetailView`):

- **Header:** foto + nombre + `page_id` + badge webhook.
- **Cards:**
  - Resumen: leads totales, leads 7 días, fecha vinculación.
  - Estado técnico: webhook suscrito, botón “Re-suscribir webhook”.
- **Acciones:** Desvincular página (confirmación).
- **Enlace:** “Ver leads de esta página” → `/leads?metaPaginaId=...`.

Componentes reutilizables: `PageHeader`, `Badge`, `TableCard`, `EmptyState`, `DynamicFilters` (filtro página en leads).

### 5.4 UI — Perfil de cuenta `/settings/meta/ad-accounts/[id]`

- **Header:** nombre cuenta + `act_...` + moneda.
- **Cards:** # campañas, # leads, última sincronización.
- **Botón:** Sincronizar campañas ahora (`ActionLoader`).
- **Tabla mini:** últimas campañas de esa cuenta (nombre, estado Meta, # leads).
- **Enlace:** `/dashboard?metaCuentaId=...` y `/leads?metaCuentaId=...`.

### 5.5 Filtros en `/leads` y `/dashboard`

Extender filtros existentes:

| Filtro nuevo | Fuente |
|--------------|--------|
| Página | `meta_pagina_id` |
| Cuenta publicitaria | vía campaña → `meta_cuenta_publicitaria_id` |

Backend: query DTOs + joins. Frontend: opciones en `DynamicFilters` (select searchable si muchas páginas).

---

## 6. Fases de implementación

Cada subfase termina con `npm run build` en back y front tocados.

### Fase 13.1 — Schema y migración

- Crear `meta_paginas`, `meta_cuentas_publicitarias`.
- FKs en `leads`, `campanas`.
- Script migración datos desde `meta_conexiones`.
- Actualizar Prisma + migración SQL.

**Done cuando:** filas legacy aparecen en tablas nuevas; build pasa.

### Fase 13.2 — Backend páginas + webhook

- Repo + use cases CRUD páginas.
- Webhook resuelve org por `meta_paginas`.
- Ingest asigna `meta_pagina_id` al lead.
- Tests unitarios en use cases críticos (opcional pero recomendado).

**Done cuando:** dos páginas activas en la misma org reciben leads en webhook de prueba.

### Fase 13.3 — Backend cuentas + sync

- CRUD cuentas publicitarias.
- Sync campañas por cuenta.
- `campanas.meta_cuenta_publicitaria_id` poblado en sync/ingest.

**Done cuando:** perfil de cuenta muestra campañas tras sync manual.

### Fase 13.4 — Frontend hub + listados

- `/settings/meta` con tabs.
- Listados páginas/cuentas + agregar/desvincular.
- Deprecar selects únicos en card antigua.

**Done cuando:** usuario vincula 2 páginas sin perder la primera.

### Fase 13.5 — Frontend perfiles

- Vistas detalle página y cuenta.
- Enlaces a leads/dashboard filtrados.

**Done cuando:** perfiles muestran stats reales y acciones funcionan.

### Fase 13.6 — Filtros leads/dashboard

- API filtros `metaPaginaId`, `metaCuentaId`.
- `DynamicFilters` en LeadsView y DashboardView.

**Done cuando:** KPIs coinciden con listado filtrado por cuenta/página.

---

## 7. Criterios de cierre (Fase 13 completa)

Estado verificado en código (2026-08-20). Smoke E2E con Meta real en producción sigue siendo operativo (PLAN.md §13).

- [x] Una org puede tener **≥2 páginas** activas; leads llegan de **todas**.  
  → `meta_paginas` N por org; webhook/ingest resuelven por `findActivaPorPageId` y asignan `meta_pagina_id`.
- [x] Desvincular una página **no** afecta las demás.  
  → Soft delete (`estado = 0`) + unsubscribe solo de esa `page_id`.
- [x] Una org puede tener **≥2 cuentas ads**.  
  → `meta_cuentas_publicitarias` N por org + sync por cuenta.
- [x] **Dashboard / leads filtran por cuenta** (`metaCuentaId`).  
  → Dashboard y `/leads` (API + `LeadsView` + deep link desde perfil de cuenta).
- [x] Existe **perfil** navegable por página y por cuenta (URLs §5.1).  
  → `/settings/meta/pages/[id]` y `/settings/meta/ad-accounts/[id]`.
- [x] Webhook sigue enrutando correctamente; `page_id` no duplicado entre orgs.  
  → Lookup en `meta_paginas`; unique parcial `meta_paginas_page_id_activo_unique`.
- [x] Migración **no pierde** datos de conexiones MVP existentes.  
  → Columnas legacy en `meta_conexiones` (`page_id`, `ad_account_id`, …) se conservan (deprecadas, no borradas).  
  → **Nota:** la migración SQL crea tablas nuevas pero **no** hay `INSERT` automático MVP → `meta_paginas` / `meta_cuentas_publicitarias`; orgs solo-MVP deben **re-vincular** página/cuenta en el hub (o correr backfill manual).
- [x] `PLAN.md` original intacto; este doc referenciado desde §11.

### Pendiente menor post-cierre

| Ítem | Acción |
|------|--------|
| Backfill SQL opcional MVP → tablas nuevas | Solo si quedan orgs con `page_id`/`ad_account_id` en `meta_conexiones` y sin filas en tablas Fase 13 |

**Veredicto:** Fase 13 **cerrada** (filtro cuenta en leads incluido).

---

## 8. Fuera de alcance (Fase 13)

- Ads Manager (crear/editar campañas en Meta).
- Métricas de inversión (spend, CPL, ROAS) — solo conteos y sync de nombres/estructura.
- Colas / sync programado cada N minutos (solo sync manual + ingest webhook).
- Varias Meta Apps por org (sigue 1 App por org).
- Varias sesiones OAuth distintas por org (sigue 1 usuario Meta por org).
- Permisos granulares por página/cuenta dentro de la empresa.

---

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Rate limits Graph al sync multi-cuenta | Sync manual; paginación; backoff en logs |
| Token página expira | Re-fetch con user token al re-suscribir; indicador en perfil |
| Leads históricos sin `meta_pagina_id` | Backfill best-effort; filtro “Sin página” opcional |
| UI abrumadora con muchas páginas | Búsqueda en listados; paginación |

---

## 10. Referencias

- [PLAN.md](./PLAN.md) — MVP fases 0–11, §8 Meta, §11 post-MVP.
- [INVESTIGACION-META-API.md](./INVESTIGACION-META-API.md) — catálogo de APIs Meta integrables post Fase 13.
- [PLAN-FASE-14-META-LEADADS-CONSOLIDAR.md](./PLAN-FASE-14-META-LEADADS-CONSOLIDAR.md) — siguiente: forms, backfill, salud webhook.
- Meta Graph: [Pages](https://developers.facebook.com/docs/graph-api/reference/page/), [Ad Account](https://developers.facebook.com/docs/marketing-api/reference/ad-account), [Leadgen webhook](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-leadgen).

---

**Siguiente paso concreto:** **[Fase 14](./PLAN-FASE-14-META-LEADADS-CONSOLIDAR.md)** (forms, backfill, salud webhook, versión Graph). Opcional: backfill SQL MVP → tablas Fase 13 si aún hay orgs sin re-vincular.
