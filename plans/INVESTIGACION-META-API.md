# Investigación Meta API — Catálogo de capacidades

Documento de **referencia de producto**: qué ofrece la plataforma Meta (Graph / Marketing / Messaging / Conversions) y **qué podemos ir integrando** en el CRM. No sustituye a [PLAN.md](./PLAN.md) (fuente de verdad de lo ya construido).

**Repos:** `back-saas-crm` · `front-saas-crm`  
**Actualizado:** 2026-08-20  
**Graph en código:** `META_GRAPH_VERSION` (default `v25.0`)

Leyenda de estado respecto a **este** CRM:

| Marca | Significado |
|-------|-------------|
| ✅ | Ya integrado (detalle en PLAN.md) |
| 🔜 | Candidato a integrar (roadmap) |
| — | No priorizar / fuera de foco |

---

## 1. Mapa de APIs Meta

| API / producto | Qué es | Relación con el CRM | Estado |
|----------------|--------|---------------------|--------|
| **Graph API** | HTTP base (nodos, edges, fields). Casi todo pasa por aquí. | Núcleo técnico | ✅ |
| **Marketing API** | Ads: cuentas, campañas, insights, leads, audiencias | Lead Ads + reporting futuro | ✅ parcial / 🔜 Insights |
| **Pages API** | Páginas FB: metadata, webhooks, leadgen forms | Páginas N + webhook | ✅ |
| **Lead Ads** | Captura FB/IG; webhooks + bulk + forms | Core del producto | ✅ |
| **Ads Insights API** | Impresiones, spend, CTR, CPL, ROAS… | Dashboard publicitario | 🔜 Oleada B |
| **Conversions API (CAPI)** | Eventos server-to-server (lead quality, compra…) | Atribución / calidad | 🔜 Oleada C |
| **Custom Audiences** | Audiencias desde CRM (email/tel hash) | Remarketing | 🔜 Oleada C |
| **Messenger Platform** | Inbox Página, envío, webhooks `messages` | Post-lead chat | 🔜 Oleada D |
| **Instagram Messaging / Comments** | DM / comentarios IG | Engagement | 🔜 / — |
| **WhatsApp Cloud API** | Plantillas, webhooks WABA | Canal LatAm | 🔜 Oleada D |
| **Ads Library API** | Transparencia pública de anuncios | Poco útil para CRM | — |
| **Business Manager / System Users** | Tokens de sistema, multi-cuenta | Escala SaaS / agencias | 🔜 |

> Graph = transporte. Marketing / Pages / WhatsApp / CAPI = casos de uso encima.

---

## 2. Catálogo de funcionalidades (por dominio)

### 2.1 Lead Ads

| Funcionalidad | Mecanismo | Valor CRM | Estado |
|---------------|-----------|-----------|--------|
| OAuth + App por org | Login Meta, token cifrado | Multi-tenant | ✅ |
| N páginas + suscripción `leadgen` | Pages + `subscribed_apps` | Leads de varias páginas | ✅ |
| Webhook en tiempo real | `POST` leadgen → fetch `/{leadgen_id}` | Ingest idempotente | ✅ |
| Catálogo `leadgen_forms` | `GET /{page-id}/leadgen_forms` | Nombres en UI / filtros | ✅ |
| Backfill histórico | `GET /{form-id}/leads` + fechas | Recuperar leads perdidos | ✅ |
| Salud webhook | `subscribed_apps` + alerta in-app | Detectar corte de leads | ✅ |
| Crear / archivar forms desde CRM | `POST /{page-id}/leadgen_forms` | Operar sin Ads Manager | 🔜 bajo (P2) |
| Quality lead optimization (CAPI Conversion Leads) | Enviar calidad CRM → Meta | Mejor delivery de ads | 🔜 Oleada C |

**Permisos típicos Lead Ads:** `pages_show_list`, `pages_manage_metadata`, `leads_retrieval`, a menudo `pages_manage_ads` / `pages_read_engagement` para edges enriquecidos.

### 2.2 Cuentas y estructura de ads

| Funcionalidad | Mecanismo | Estado |
|---------------|-----------|--------|
| N cuentas publicitarias | `/me/adaccounts` + tabla local | ✅ |
| Sync campaña → ad set → ad | Marketing edges, sync manual | ✅ |
| Perfiles página / cuenta en UI | Hub `/settings/meta` | ✅ |
| Pausar / activar campaña o ad | `ads_management` | 🔜 Oleada E |
| Crear campañas / creativos | Ads Management completo | — |

### 2.3 Ads Insights (métricas)

| Funcionalidad | Endpoints | Valor | Estado |
|---------------|-----------|-------|--------|
| KPIs cuenta/campaña/ad | `GET /{id}/insights` | Spend, CTR, impressions | 🔜 Oleada B |
| Breakdowns (día, edad, placement…) | `breakdowns`, `time_increment` | Dashboard avanzado | 🔜 |
| Async insights (volumen alto) | Jobs asíncronos | Orgs grandes | 🔜 (requiere cola) |
| CPL híbrido | spend Meta ÷ leads CRM | KPI inmobiliario clave | 🔜 Oleada B |
| ROAS / conversiones ads | Insights + Pixel/CAPI | Si hay cierre de venta | 🔜 |

**Permiso:** `ads_read` (+ Marketing API Access Tier / App Review según alcance).

### 2.4 Audiencias y remarketing

| Funcionalidad | Valor | Estado |
|---------------|-------|--------|
| Custom Audience desde leads (hash SHA-256) | Retargeting calientes/fríos | 🔜 Oleada C |
| Exclusion audiences (cerrados) | No gastar en convertidos | 🔜 |
| Lookalike / Advantage+ | Expansión | 🔜 bajo |

Requisitos: Business verification, hashing correcto, consentimiento.

### 2.5 Conversions API (general)

| Funcionalidad | Valor | Estado |
|---------------|-------|--------|
| Eventos Lead / CompleteRegistration desde CRM | Atribución server-side | 🔜 Oleada C (con estados de lead) |
| Purchase / Schedule | Si hay cierre en CRM | 🔜 |
| Test Events / depuración | Ops | 🔜 al implementar |

Hoy el CRM no tiene pipeline de estados; CAPI gana sentido cuando exista.

### 2.6 Mensajería post-lead

| Canal | Capacidad | Estado |
|-------|-----------|--------|
| **WhatsApp Cloud API** | Plantillas, ventana 24h, webhooks | 🔜 Oleada D (módulo aparte) |
| **Messenger (Page)** | Texto / plantillas, inbox | 🔜 Oleada D |
| Instagram DM | Messaging API IG | 🔜 |
| Click-to-WA / Click-to-Messenger ads | Atribución conversacional | 🔜 |

### 2.7 Página / Instagram orgánicos

| Funcionalidad | Estado |
|---------------|--------|
| Comentarios en posts/ads → lead/tarea | 🔜 bajo |
| Publicar posts / Stories / IG Content Publishing | — |

### 2.8 Gobernanza SaaS

| Funcionalidad | Estado |
|---------------|--------|
| Meta App + OAuth por organización | ✅ |
| Advanced Access App Review (cuentas de terceros) | 🔜 ops al escalar Live |
| System User + token Business | 🔜 escala agencias |
| `business_management` | 🔜 |

---

## 3. Matriz “¿lo integramos?”

| Idea | ¿Encaja? | Notas |
|------|----------|--------|
| Lead Ads + multi página/cuenta + forms/backfill | ✅ Hecho | PLAN.md §8 |
| Insights + CPL | Sí | Siguiente valor claro |
| CAPI calidad + audiencias | Sí | Tras estados de lead |
| WhatsApp inbox | Sí, módulo aparte | Alto valor LatAm |
| Pausar campañas | Opcional | Oleada E |
| Crear ads/creatives | No ahora | Competir con Ads Manager |
| Publicación orgánica | No | Fuera de visión CRM |

---

## 4. Permisos (mapa rápido)

| Scope / feature | Hoy | Para ampliar |
|-----------------|-----|--------------|
| `pages_show_list` | ✅ | |
| `pages_manage_metadata` | ✅ | Webhooks |
| `leads_retrieval` | ✅ | Leads |
| `ads_read` | ✅ | Sync + **Insights** |
| `pages_manage_ads` | — | Forms write / algunos edges |
| `pages_read_engagement` | — | Comentarios |
| `ads_management` | — | Pausar/crear ads |
| `business_management` | — | BM / system users |
| `whatsapp_business_*` | — | WhatsApp Cloud |
| Marketing API Access Tier | Revisar en App Dashboard | Cuotas Insights |
| Advanced Access | Crítico en Live multi-cliente | App Review |

---

## 5. Rate limits y operación

- Marketing / Pages (page o system token) → **BUC** (`X-Business-Use-Case-Usage`).
- Insights: BUC propio; reportes grandes → async.
- Leadgen bulk: límites; preferir webhook + backfill puntual (ya así).
- `429` → backoff; Insights agresivos o sync horario → **cola** (hoy sin Redis/BullMQ).

---

## 6. Roadmap de integración

### Oleada A — Consolidar Lead Ads ✅

Forms, backfill, salud webhook, versión Graph. → [PLAN.md](./PLAN.md) fases 12–14 / §8.4.

### Oleada B — Dashboard publicitario 🔜

1. Pull Insights por cuenta/campaña (on-demand o diario).  
2. KPIs híbridos: spend + leads → **CPL**.  
3. Dashboard filtrado por cuenta (base ya existe).

### Oleada C — Loop marketing ↔ CRM 🔜

1. Estados mínimos de lead.  
2. CAPI Conversion Leads.  
3. Custom Audiences.

### Oleada D — Conversación 🔜

1. WhatsApp Cloud (módulo catálogo).  
2. Opcional Messenger.  
3. Atribución click-to-WA.

### Oleada E — Ads ops ligeros 🔜 / opcional

1. Pausar/activar campañas.  
2. No Ads Manager completo.

Al ejecutar una oleada: crear `PLAN-FASE-XX-….md` solo para esa fase; al cerrarla, **absorber en PLAN.md** y borrar el subplan.

---

## 7. Endpoints Graph de referencia

| Uso | Path (patrón) | Estado en CRM |
|-----|---------------|---------------|
| OAuth dialog | `facebook.com/{ver}/dialog/oauth` | ✅ |
| Token exchange | `/oauth/access_token` | ✅ |
| Páginas | `/me/accounts` | ✅ |
| Ad accounts | `/me/adaccounts` | ✅ |
| Suscripción página | `/{page-id}/subscribed_apps` | ✅ |
| Lead por id | `/{leadgen-id}` | ✅ |
| Forms de página | `/{page-id}/leadgen_forms` | ✅ |
| Leads de form | `/{form-id}/leads` | ✅ backfill |
| Campañas / ad sets / ads | `/act_{id}/campaigns` … | ✅ sync |
| Insights | `/{object-id}/insights` | 🔜 |
| Custom audience | `/act_{id}/customaudiences` | 🔜 |
| CAPI events | `/{pixel-id}/events` | 🔜 |

---

## 8. Fuera de alcance recomendado

- Ads Library / Catalog / Commerce / Shops  
- Marketing Mix Modeling  
- Publicación orgánica masiva  
- Competir con Meta Ads Manager o Business Suite  

---

## 9. Criterios para abrir una integración

1. ¿Resuelve dolor del usuario (agencia / inmobiliaria)?  
2. ¿Permisos y App Review claros?  
3. ¿Submódulo Meta o módulo nuevo del catálogo?  
4. ¿Rate limits / jobs requieren cola?  
5. ¿PII, retención y consentimiento resueltos?

---

## 10. Referencias oficiales

- [Lead Ads](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/)  
- [Retrieving Leads](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/)  
- [Lead Forms](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/create/)  
- [Ads Insights](https://developers.facebook.com/docs/marketing-api/insights)  
- [Marketing API Authorization](https://developers.facebook.com/docs/marketing-api/get-started/authorization/)  
- [Graph Rate Limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/)  
- [Conversions API / Conversion Leads](https://developers.facebook.com/docs/marketing-api/conversions-api/conversion-leads-integration/)  
- [Custom Audiences](https://developers.facebook.com/docs/marketing-api/audiences/guides/custom-audiences)  
- [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)

---

**Uso:** este archivo es el **menú de la API**. [PLAN.md](./PLAN.md) es lo **ya construido**. Siguiente implementación sugerida: **Oleada B** (Insights/CPL).
