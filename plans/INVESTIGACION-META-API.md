# Investigación Meta API — Catálogo de capacidades

Documento de **referencia de producto**: qué ofrece la plataforma Meta (Graph / Marketing / Messaging / Conversions / Commerce / sociales) y **qué podemos ir integrando** en el CRM.

**No es un dump exhaustivo de cada endpoint Graph** (miles de nodos/edges). Sí es un **inventario de productos oficiales** contrastado con [developers.facebook.com](https://developers.facebook.com/) (ago 2026), marcado por relevancia CRM.

No sustituye a [PLAN.md](./PLAN.md) (fuente de verdad de lo ya construido).

**Repos:** `back-saas-crm` · `front-saas-crm`  
**Actualizado:** 2026-08-20 (auditoría web)  
**Graph en código:** `META_GRAPH_VERSION` (default `v25.0`)  
**Nota versión:** Meta publicó **Graph / Marketing API v26.0** (jul 2026). Revisar changelog antes de subir `META_GRAPH_VERSION` (deprecaciones Commerce Order Management, placements IG Explore / Messenger Stories, etc.).

Leyenda de estado respecto a **este** CRM:

| Marca | Significado |
|-------|-------------|
| ✅ | Ya integrado (detalle en PLAN.md) |
| 🔜 | Candidato a integrar (roadmap) |
| — | Documentado / existe en Meta, **no priorizar** para este CRM |

---

## 0. Alcance de esta investigación

| Pregunta | Respuesta |
|----------|-----------|
| ¿Está *todo* lo que Meta ofrece? | **No a nivel de cada field/edge.** Sí a nivel de **familias de producto** oficiales relevantes para ads, leads, mensajería, medición y presencia. |
| ¿Qué faltaba antes de esta auditoría? | Catalog/Commerce, Ad Rules, Pixel vs Dataset, Page/IG Insights orgánicos, Threads, Marketing Messages WA, Calling/Groups WA, Embedded Signup, creatives assets, batch Graph, etc. (ver §11). |
| ¿Cómo usarlo? | Menú para decidir oleadas. Implementación = `PLAN-FASE-XX` → absorber en PLAN.md. |

---

## 1. Mapa de APIs / productos Meta

### 1.1 Núcleo (ads + leads + CRM)

| API / producto | Qué es | Relación con el CRM | Estado |
|----------------|--------|---------------------|--------|
| **Graph API** | HTTP base (nodos, edges, fields). Casi todo pasa por aquí. | Núcleo técnico | ✅ |
| **Marketing API** | Ads: cuentas, campañas, insights, leads, audiencias, creatives | Lead Ads + reporting | ✅ estructura/leads/Insights · 🔜 audiencias (Oleada C) |
| **Pages API** | Páginas FB: metadata, webhooks, leadgen forms | Páginas N + webhook | ✅ |
| **Lead Ads** | Captura FB/IG; webhooks + bulk + forms | Core del producto | ✅ |
| **Ads Insights API** | Impresiones, spend, CTR, CPL, ROAS… | Dashboard publicitario | ✅ Oleada B (Fase 15) |
| **Conversions API (CAPI)** | Eventos S2S (web/app/offline/messaging) vía Dataset | Atribución / calidad | 🔜 Oleada C |
| **Meta Pixel** | Eventos browser (complemento CAPI; dedupe `event_id`) | Medición web del cliente | — / 🔜 si hay web del anunciante |
| **Custom Audiences** | Audiencias desde CRM (email/tel hash) + website/app/engagement | Remarketing | 🔜 Oleada C |
| **Lookalike / Advantage+ audiences** | Expansión desde seed | Growth ads | 🔜 bajo |
| **Business Management API** | BM, assets, usuarios, permisos, portfolios | Escala SaaS / agencias | 🔜 |
| **System Users** | Tokens de máquina sin login humano | Ops multi-cliente | 🔜 |

### 1.2 Mensajería

| API / producto | Qué es | Relación CRM | Estado |
|----------------|--------|--------------|--------|
| **Messenger Platform** | Inbox Página, Send API, webhooks `messages` | Post-lead chat | 🔜 Oleada D |
| **Instagram Messaging** | DM IG (via Page o IG Login) | Engagement | 🔜 / — |
| **WhatsApp Cloud API** | Mensajes, plantillas, webhooks WABA | Canal LatAm | 🔜 Oleada D |
| **WhatsApp Business Management API** | WABA, números, plantillas, analytics | Ops WA | 🔜 con Oleada D |
| **Marketing Messages API (WA / MM Lite)** | Marketing optimizado sobre Cloud API | Campañas WA | — / 🔜 tarde |
| **WhatsApp Calling / Groups** | Llamadas y grupos vía Cloud API | Contact center | — |
| **Embedded Signup** | Onboarding WABA embebido (partners) | SaaS multi-tenant WA | 🔜 si módulo WA partner |
| **Meta Business Agent** | Agentes AI en WhatsApp | Automatización | — |

### 1.3 Comercio, catálogo, creatives, automatización ads

| API / producto | Qué es | Relación CRM | Estado |
|----------------|--------|--------------|--------|
| **Catalog / Product Catalog API** | Feeds, product sets, Advantage+ catalog ads | E-commerce / catálogo inmuebles? | — (salvo vertical catálogo) |
| **Commerce API** | Shops / Marketplace; **Order Management deprecado en v26** | Tiendas Meta | — |
| **Ad creatives / adimages / advideos** | Librería de assets y creativos | Ads Manager en CRM | — |
| **Ad Previews** | Preview de anuncio | UX ads ops | — |
| **Ad Rules Engine** | Reglas schedule/trigger (pausar, budget…) | Automatización ligera | 🔜 bajo (Oleada E+) |
| **Batch + Async Marketing** | Hasta 50 calls/batch; insights async | Escala Insights | 🔜 post-15 / cola |
| **Ads Library API** (`ads_archive`) | Transparencia pública de anuncios | Research, no CRM ops | — |
| **Threads Ads** | Placements/creatives Threads en Marketing API | Ads multi-superficie | — |

### 1.4 Orgánico / sociales (no ads)

| API / producto | Qué es | Relación CRM | Estado |
|----------------|--------|--------------|--------|
| **Instagram Graph / Content Publishing** | Publicar posts, reels, carruseles; insights IG | Social publishing | — |
| **Page Insights (orgánico)** | Métricas de Página (no Ads Insights) | Brand analytics | — |
| **Threads API** (`graph.threads.net`) | Publicar / replies / insights Threads | Social | — |
| **Comentarios Page/IG → lead** | Webhooks comments + private reply | Captura social | 🔜 bajo |
| **Facebook Login (consumer)** | Login usuarios finales | Auth app B2C | — (CRM usa Login for Business / OAuth org) |

### 1.5 Medición avanzada / legacy

| API / producto | Qué es | Estado |
|----------------|--------|--------|
| **Datasets (Events Manager)** | Unifica Pixel + app + offline + messaging bajo un `dataset_id` | 🔜 con CAPI |
| **Offline Conversions API** | Legacy; Meta recomienda CAPI offline | — (usar CAPI) |
| **App Events API** | Legacy app; Meta recomienda CAPI app events | — |
| **Marketing Mix Modeling (MMM) guides** | Insights agregados / privacy | — |
| **Brand safety / exclusions** | Controles en ad sets | — |

> Graph = transporte. El resto = casos de uso encima.

---

## 2. Catálogo de funcionalidades (por dominio CRM)

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
| Usuarios de ad account (`/act_{id}/users`) | Gobernanza | — |
| Pausar / activar campaña o ad | `ads_management` | 🔜 Oleada E |
| Ad Rules (auto-pausar por CPL/spend) | `adrules_library` | 🔜 bajo |
| Crear campañas / creativos / assets | Ads Management completo | — |

### 2.3 Ads Insights (métricas)

| Funcionalidad | Endpoints | Valor | Estado |
|---------------|-----------|-------|--------|
| KPIs cuenta/campaña/ad | `GET /{id}/insights` | Spend, CTR, impressions | ✅ Fase 15 |
| Breakdowns (día, edad, placement…) | `breakdowns`, `time_increment` | Dashboard avanzado | 🔜 (día ✅ vía `time_increment=1`; demográficos post-15) |
| Async insights (volumen alto) | Jobs asíncronos | Orgs grandes | 🔜 (requiere cola) |
| Batch Graph (≤50) | `?batch=` | Menos round-trips | 🔜 post-15 |
| CPL híbrido | spend Meta ÷ leads CRM | KPI inmobiliario clave | ✅ Fase 15 |
| ROAS / conversiones ads | Insights + Pixel/CAPI | Si hay cierre de venta | 🔜 |
| Product-level / catalog reporting | Insights + catalog | Solo si hay catálogo | — |

**Permiso:** `ads_read` (+ Marketing API Access Tier / App Review según alcance).

### 2.4 Audiencias y remarketing

| Funcionalidad | Valor | Estado |
|---------------|-------|--------|
| Custom Audience desde leads (hash SHA-256) | Retargeting calientes/fríos | 🔜 Oleada C |
| Exclusion audiences (cerrados) | No gastar en convertidos | 🔜 |
| Website / engagement / app custom audiences | Requiere Pixel/SDK | — / 🔜 si hay web |
| Lookalike / Advantage+ | Expansión | 🔜 bajo |

Requisitos: Business verification, hashing correcto, consentimiento.

### 2.5 Conversions API (general)

| Funcionalidad | Valor | Estado |
|---------------|-------|--------|
| Eventos Lead / CompleteRegistration desde CRM | Atribución server-side | 🔜 Oleada C (con estados de lead) |
| Purchase / Schedule | Si hay cierre en CRM | 🔜 |
| Offline / physical_store | Visitas a oficina / firma | 🔜 bajo |
| Messaging events vía CAPI | Atribución chat | 🔜 con Oleada D |
| Dataset + dedupe con Pixel | Events Manager unificado | 🔜 al implementar |
| Test Events / depuración | Ops | 🔜 al implementar |

Hoy el CRM no tiene pipeline de estados; CAPI gana sentido cuando exista.

### 2.6 Mensajería post-lead

| Canal | Capacidad | Estado |
|-------|-----------|--------|
| **WhatsApp Cloud API** | Texto, media, interactivos, plantillas, ventana 24h, webhooks | 🔜 Oleada D (módulo aparte) |
| **WA Business Management** | Templates, números, insights WA | 🔜 con D |
| **Marketing Messages (MM Lite)** | Marketing optimizado WA | — / tarde |
| **WA Calling / Groups** | Llamadas y grupos | — |
| **Embedded Signup** | Onboard clientes SaaS a WABA | 🔜 si partner |
| **Messenger (Page)** | Texto / plantillas, inbox | 🔜 Oleada D |
| Instagram DM | Messaging API IG | 🔜 |
| Click-to-WA / Click-to-Messenger ads | Atribución conversacional | 🔜 |

### 2.7 Página / Instagram / Threads orgánicos

| Funcionalidad | Estado |
|---------------|--------|
| Comentarios en posts/ads → lead/tarea | 🔜 bajo |
| Page Insights orgánicos | — |
| Instagram Content Publishing + IG Insights | — |
| Threads publish / insights | — |
| Publicar posts / Stories FB masivo | — |

### 2.8 Comercio y catálogo

| Funcionalidad | Estado |
|---------------|--------|
| Product Catalog / feeds / product sets | — |
| Advantage+ catalog ads / dynamic ads | — |
| Commerce / Shops (Order Mgmt deprecado v26) | — |

### 2.9 Gobernanza SaaS

| Funcionalidad | Estado |
|---------------|--------|
| Meta App + OAuth por organización | ✅ |
| Advanced Access App Review (cuentas de terceros) | 🔜 ops al escalar Live |
| System User + token Business | 🔜 escala agencias |
| `business_management` | ✅ opt-in Fase 16 (OAuth dinámico) |
| Salud permisos token (`debug_token`) en UI Conexión | ✅ Fase 16 (lectura + opt-in toggles) |
| Webhooks no-leadgen (`messages`, `feed`, etc.) | 🔜 según oleada |

---

## 3. Matriz “¿lo integramos?”

| Idea | ¿Encaja? | Notas |
|------|----------|--------|
| Lead Ads + multi página/cuenta + forms/backfill | ✅ Hecho | PLAN.md §8 |
| Insights + CPL | ✅ Hecho | PLAN.md Fase 15 |
| Salud permisos + opt-in scopes | ✅ Hecho | PLAN.md Fase 16 |
| CAPI calidad + audiencias | Sí | Tras estados de lead |
| WhatsApp inbox (+ Embedded Signup si partner) | Sí, módulo aparte | Alto valor LatAm |
| Pausar campañas / Ad Rules simples | Opcional | Oleada E |
| Crear ads/creatives / catalog / commerce | No ahora | Competir con Ads Manager / Commerce |
| IG/Threads publishing, Page Insights orgánicos | No | Fuera de visión CRM |
| Ads Library / MMM / Brand safety profundo | No | Research / enterprise ads |

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
| `pages_messaging` | — | Messenger |
| `instagram_basic` / `instagram_manage_messages` | — | IG DM |
| `instagram_content_publish` | — | Publishing IG |
| `ads_management` | — | Pausar/crear ads / rules |
| `business_management` | — | BM / system users (dependency frecuente) |
| `whatsapp_business_management` | — | WABA / templates |
| `whatsapp_business_messaging` | — | Envío Cloud API |
| Marketing API Access Tier | Revisar en App Dashboard | Cuotas Insights |
| Advanced Access | Crítico en Live multi-cliente | App Review |

---

## 5. Rate limits y operación

- Marketing / Pages (page o system token) → **BUC** (`X-Business-Use-Case-Usage`).
- Insights: BUC propio; reportes grandes → **async** (+ opcional batch ≤50).
- Leadgen bulk: límites; preferir webhook + backfill puntual (ya así).
- WhatsApp: límites por nivel de calidad / messaging limit del número.
- `429` → backoff; Insights agresivos o sync horario → **cola** (hoy sin Redis/BullMQ).

---

## 6. Roadmap de integración

### Oleada A — Consolidar Lead Ads ✅

Forms, backfill, salud webhook, versión Graph. → [PLAN.md](./PLAN.md) fases 12–14 / §8.4.

### Oleada B — Dashboard publicitario ✅

Insights diarios + CPL híbrido + sync on-demand. → [PLAN.md](./PLAN.md) Fase 15.

### Oleada C — Loop marketing ↔ CRM 🔜

1. Estados mínimos de lead.  
2. CAPI Conversion Leads (+ Dataset).  
3. Custom Audiences (inclusión/exclusión).

### Oleada D — Conversación 🔜

1. WhatsApp Cloud (+ Business Management; Embedded Signup si modelo partner).  
2. Opcional Messenger.  
3. Atribución click-to-WA / messaging events CAPI.

### Oleada E — Ads ops ligeros 🔜 / opcional

1. Pausar/activar campañas.  
2. Ad Rules simples (opcional).  
3. No Ads Manager / Catalog / Commerce completo.

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
| Insights | `/{object-id}/insights` | ✅ sync + persistencia diaria |
| Custom audience | `/act_{id}/customaudiences` | 🔜 |
| CAPI events | `/{pixel-or-dataset-id}/events` | 🔜 |
| Ad rules | `/act_{id}/adrules_library` | — |
| Catalog | `/{business-id}/owned_product_catalogs` | — |
| WA messages | `/{phone-number-id}/messages` | 🔜 Oleada D |
| Ads archive (Library) | `/ads_archive` | — |

---

## 8. Fuera de alcance recomendado

- Ads Library / Catalog / Commerce / Shops  
- Marketing Mix Modeling  
- Publicación orgánica masiva (FB/IG/Threads)  
- Competir con Meta Ads Manager o Business Suite  
- WhatsApp Calling/Groups, Meta Business Agent (salvo demanda explícita)  
- Brand safety enterprise profundo  

---

## 9. Criterios para abrir una integración

1. ¿Resuelve dolor del usuario (agencia / inmobiliaria)?  
2. ¿Permisos y App Review claros?  
3. ¿Submódulo Meta o módulo nuevo del catálogo?  
4. ¿Rate limits / jobs requieren cola?  
5. ¿PII, retención y consentimiento resueltos?

---

## 10. Referencias oficiales

### Leads / Marketing core
- [Lead Ads](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/)  
- [Retrieving Leads](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/)  
- [Lead Forms](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/create/)  
- [Marketing API](https://developers.facebook.com/docs/marketing-api)  
- [Ads Insights](https://developers.facebook.com/docs/marketing-api/insights)  
- [Async / Batch](https://developers.facebook.com/docs/marketing-api/asyncrequests/)  
- [Ad Rules Engine](https://developers.facebook.com/docs/marketing-api/ad-rules/overview/)  
- [Marketing API Authorization](https://developers.facebook.com/docs/marketing-api/get-started/authorization/)  
- [Graph Rate Limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/)  

### Medición / audiencias
- [Conversions API](https://developers.facebook.com/docs/marketing-api/conversions-api)  
- [Conversion Leads](https://developers.facebook.com/docs/marketing-api/conversions-api/conversion-leads-integration/)  
- [Custom Audiences](https://developers.facebook.com/docs/marketing-api/audiences/guides/custom-audiences)  
- [Lookalike Audiences](https://developers.facebook.com/docs/marketing-api/audiences/guides/lookalike-audiences/)  

### Related Marketing
- [Catalog / Business assets](https://developers.facebook.com/docs/marketing-api/business-asset-management/guides/catalog/)  
- [Business Management](https://developers.facebook.com/docs/marketing-api) (related: Business Management API)  
- [Commerce API](https://developers.facebook.com/docs/commerce-platform)  

### Mensajería / social
- [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)  
- [WhatsApp Embedded Signup](https://developers.facebook.com/docs/whatsapp/embedded-signup/)  
- [Marketing Messages API for WhatsApp](https://developers.facebook.com/docs/whatsapp/marketing-messages-lite-api/)  
- [Messenger Platform](https://developers.facebook.com/docs/messenger-platform/overview/)  
- [Instagram Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing)  

### Versiones
- [Graph / Marketing API v26.0 changelog (blog)](https://developers.facebook.com/blog/post/2026/07/29/introducing-graph-api-v26-and-marketing-api-v26/)  

---

## 11. Hallazgos de la auditoría web (qué faltaba)

Antes de esta pasada el doc cubría bien el **hilo CRM Lead Ads → Insights → CAPI → Audiencias → Chat**, pero **no** listaba varias familias oficiales de Meta. Incorporadas arriba como **—** o 🔜 bajo:

| Familia | Por qué importa saberlo |
|---------|-------------------------|
| Catalog + Commerce (+ deprecación Order Mgmt v26) | No confundir “Marketing API” con tienda Meta |
| Ad Rules Engine | Alternativa a pausar manual (Oleada E+) |
| Pixel + Datasets unificados | CAPI ya no es solo `pixel_id` |
| Page / IG Insights orgánicos vs Ads Insights | Dos productos distintos |
| Instagram Publishing + Threads API/Ads | Social ≠ CRM leads |
| WA: Business Management, MM Lite, Calling, Groups, Embedded Signup, Business Agent | Cloud API messaging ≠ plataforma WA completa |
| Creatives / adimages / advideos / previews | Ads Manager completo |
| Batch Graph + async insights | Diseño a escala post-Fase 15 |
| Ads Library (`ads_archive`) | Transparencia, no ops del anunciante |
| App Events / Offline legacy | Preferir CAPI |
| Graph v26 disponible | Planificar upgrade desde `v25.0` |

**Conclusión:** para el CRM **no faltaba el camino crítico** (Lead Ads → Insights → CAPI → WA). Faltaba el **mapa periférico** para no reinventar Commerce/Social/Ads Manager ni subestimar el tamaño real de WhatsApp y medición.

---

**Uso:** este archivo es el **menú de la API (CRM + inventario oficial)**. [PLAN.md](./PLAN.md) es lo **ya construido** (fases 0–16). Siguiente: **Oleada C** (CAPI / audiencias) o smoke Meta real.
