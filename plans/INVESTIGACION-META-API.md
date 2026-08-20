# Investigación Meta API — Funcionalidades integrables al CRM

Documento de **investigación y roadmap de producto**. No es un plan de implementación fase-a-fase: lista qué ofrece la plataforma Meta (Graph / Marketing / Messaging / Conversions) y **qué encaja** en este SaaS CRM multi-tenant.

**Repos:** `back-saas-crm` · `front-saas-crm`  
**Fecha de investigación:** 2026-08-20  
**API Graph de referencia en código hoy:** `v21.0` (OAuth); docs oficiales recientes usan `v25.0` / `v26.0` — conviene unificar versión en un solo constant.  
**Documentos relacionados:** [PLAN.md](./PLAN.md) · [PLAN-FASE-13-META-MULTI.md](./PLAN-FASE-13-META-MULTI.md)

---

## 1. Mapa de APIs Meta (qué es cada una)

| API / producto | Qué es | Relación con el CRM |
|----------------|--------|---------------------|
| **Graph API** | HTTP base de Meta (nodos, edges, fields). Casi todo pasa por aquí. | Núcleo técnico. |
| **Marketing API** | Subconjunto del Graph orientado a ads: cuentas, campañas, insights, leads, audiencias. | Principal para Lead Ads + reporting. |
| **Pages API** | Páginas FB: metadata, suscripciones webhook, formularios leadgen, engagement. | Ya usamos páginas + webhook leadgen. |
| **Lead Ads (guía Marketing)** | Captura de leads en FB/IG; webhooks + lectura bulk + forms. | **Core actual del producto.** |
| **Ads Insights API** | Métricas de rendimiento (impresiones, spend, CTR, CPL, ROAS…). | Post-MVP listado en PLAN.md §11. |
| **Conversions API (CAPI)** | Envío server-to-server de eventos (compra, lead quality, etc.) a Meta. | Mejora atribución y calidad de leads. |
| **Custom Audiences** | Subir/segmentar audiencias desde CRM (emails/teléfonos hasheados). | Remarketing / lookalikes. |
| **Messenger Platform** | Chat de Página (inbox, envío, webhooks `messages`). | Conversación post-lead. |
| **Instagram Messaging / Comments** | Mensajes IG y comentarios (permisos y App Review más estrictos). | Engagement, no leadgen puro. |
| **WhatsApp Cloud API** | Mensajes WA Business (plantillas, webhooks). | Módulo distinto; alto valor comercial, otro producto. |
| **Ads Library API** | Transparencia pública de anuncios. | Poco útil para CRM de clientes. |
| **Business Manager / System Users** | Gobernanza multi-cuenta, tokens de sistema que no dependen de un humano. | Escala SaaS / agencias. |

> **Regla práctica:** Graph = transporte. Marketing / Pages / WhatsApp / CAPI = *casos de uso* encima del Graph.

---

## 2. Qué ya integramos (estado del CRM)

Scopes OAuth actuales (`obtener-url-oauth.use-case.ts`):

```
pages_show_list · pages_manage_metadata · leads_retrieval · ads_read
```

| Capacidad | Estado | Notas |
|-----------|--------|--------|
| Meta App por organización (App ID/Secret) | ✅ | Multi-tenant |
| OAuth usuario + token larga duración cifrado | ✅ | AES-256-GCM |
| Listar / vincular N páginas | ✅ | Fase 13 |
| Suscribir webhook `leadgen` por página | ✅ | |
| Webhook público verify + firma HMAC | ✅ | Enrutado por `page_id` |
| Fetch lead `/{leadgen_id}` al recibir evento | ✅ | Idempotente por `id_externo` |
| Listar / vincular N ad accounts | ✅ | Fase 13 |
| Sync jerarquía campaña → ad set → ad | ✅ | Manual / al vincular |
| Perfiles página / cuenta + filtros leads/dashboard | ✅ | |
| Bulk read histórico de leads (`/{form-id}/leads`) | ❌ | Solo push webhook |
| Insights (spend, CPL, CTR…) | ❌ | Explicitamente fuera de MVP |
| Crear/editar campañas o forms | ❌ | |
| CAPI / lead quality events | ❌ | |
| Custom audiences | ❌ | |
| Messenger / WhatsApp / IG inbox | ❌ | |

---

## 3. Catálogo de funcionalidades integrables

Prioridad orientativa para **este** producto (CRM de leads inmobiliarios / multiempresa), no para un Ads Manager genérico.

Leyenda: **P0** alto valor / bajo-medio esfuerzo relativo · **P1** alto valor con más costo · **P2** estratégico o pesado · **—** no recomendado ahora.

### 3.1 Lead Ads (profundizar el core)

| Funcionalidad | Endpoints / mecanismo | Permisos típicos | Valor CRM | Prioridad | Complejidad |
|---------------|----------------------|------------------|-----------|-----------|-------------|
| **Bulk read / backfill de leads** | `GET /{form-id}/leads`, `GET /{ad-id}/leads` (+ filtering por fecha) | `leads_retrieval`, `pages_*`, a menudo `ads_management` o `pages_manage_ads` | Recuperar leads perdidos si falló el webhook; migración inicial | **P0** | Media |
| **Catálogo de formularios leadgen** | `GET /{page-id}/leadgen_forms`, `GET /{form-id}` | Page token + `leads_retrieval` / pages | Filtros UI por formulario con nombre real; backfill | **P0** | Baja–media |
| **Crear / archivar lead forms** | `POST /{page-id}/leadgen_forms`, archive form | `pages_manage_ads`, etc. | Clientes crean forms desde el CRM | P2 | Alta (UX + App Review) |
| **Quality lead optimization (CAPI Conversion Leads)** | Enviar a Meta eventos CRM (lead calificado, descartado, cerrado) con **Lead ID Meta** | CAPI + integración Conversion Leads | Mejora delivery/calidad de ads del cliente | **P1** | Alta |
| **Re-suscripción / health check webhook** | Ya parcial: resync | Actual | Alertas si página deja de estar suscrita | P0 (mejora) | Baja |
| **Lead Access Manager awareness** | Documentación + checks de error Graph | — | Evitar “0 leads” por permisos de página | P0 (ops/docs) | Baja |

### 3.2 Ads Insights (métricas publicitarias)

| Funcionalidad | Endpoints | Permisos | Valor CRM | Prioridad | Complejidad |
|---------------|-----------|----------|-----------|-----------|-------------|
| **KPIs de cuenta/campaña/ad** | `GET /{act_id\|campaign\|adset\|ad}/insights` | `ads_read` (+ Marketing Access Tier) | CPL, spend, CTR junto a leads del CRM | **P1** | Media |
| **Breakdowns** (día, edad, género, placement) | `insights` + `breakdowns` / `time_increment` | `ads_read` | Dashboard avanzado | P1 | Media |
| **Async insights** (reportes grandes) | Jobs asíncronos Insights | `ads_read` | Orgs con mucho volumen | P2 | Alta (colas) |
| **ROAS / conversiones de ads** | Insights + Pixel/CAPI bien configurados | `ads_read` + datos de conversión | Solo si el cliente trackea compras | P2 | Alta |

Métricas útiles para inmobiliaria / leadgen:

- `spend`, `impressions`, `clicks`, `ctr`, `cpc`
- `actions` / `cost_per_action_type` (esp. lead)
- CPL estimado = spend / leads CRM (híbrido: Insights + BD propia)

### 3.3 Gestión de anuncios (Ads Management)

| Funcionalidad | Valor CRM | Prioridad | Nota |
|---------------|-----------|-----------|------|
| Pausar / activar campaña o ad | Operación rápida sin Ads Manager | P2 | Requiere `ads_management` + App Review avanzado |
| Cambiar presupuesto / pujas | Automatización media | P2 / — | Fuera del foco CRM; riesgo alto |
| Crear campañas / creativos | Ads Manager embebido | **—** | Producto distinto; no priorizar |
| Duplicar ads / A-B | Agencias | **—** | |

### 3.4 Audiencias y remarketing

| Funcionalidad | Endpoints | Valor CRM | Prioridad |
|---------------|-----------|-----------|-----------|
| **Custom Audience desde leads** (email/tel hash SHA-256) | `POST /act_{id}/customaudiences` + users | Retargeting “leads calientes / fríos” | **P1** |
| Lookalike / Advantage+ audiences | Sobre custom audience | Expansión de prospección | P2 |
| Exclusion audiences (clientes cerrados) | Misma API | Evitar gastar en convertidos | P1 |

Requisitos: Business verification, políticas de datos, hashing correcto, consentimientos.

### 3.5 Conversions API (general) + Pixel

| Funcionalidad | Valor | Prioridad |
|---------------|-------|-----------|
| **CAPI Lead / CompleteRegistration** desde el CRM | Atribución server-side cuando el lead “avanza” en pipeline | P1 (cuando exista pipeline/estados) |
| CAPI Purchase / Schedule | Si hay cierre de venta en el CRM | P2 |
| Depurar eventos (Test Events) | Ops | P1 al implementar |

Hoy el CRM **no tiene pipeline**; CAPI gana sentido cuando exista estado de lead (contactado, visita, cerrado).

### 3.6 Mensajería post-lead

| Canal | Capacidad | Valor CRM | Prioridad | Complejidad |
|-------|-----------|-----------|-----------|-------------|
| **Messenger (Page)** | Webhook `messages`, envío texto/plantillas | Contactar lead desde el CRM | P1 | Alta |
| **Instagram DM** | Messaging API IG | Misma UX multi-canal | P2 | Alta + review |
| **WhatsApp Cloud API** | Plantillas, ventanas 24h, webhooks | Canal #1 en LatAm inmobiliario | **P1–P2** | Muy alta (WABA, templates, pricing) |
| Click-to-WhatsApp / Click-to-Messenger ads insights | Unir anuncio ↔ conversación | Atribución conversacional | P2 | Alta |

Recomendación: tratar WhatsApp como **módulo de producto aparte** (`WHATSAPP` en catálogo), no como extensión silenciosa de `META_LEADS`.

### 3.7 Página / Instagram orgánicos (engagement)

| Funcionalidad | Valor CRM | Prioridad |
|---------------|-----------|-----------|
| Comentarios en posts/ads → lead o tarea | Social listening ligero | P2 |
| Publicar posts / Stories por API | CMS social | **—** |
| Instagram Content Publishing | Marketing de contenidos | **—** |

### 3.8 Gobernanza multi-tenant (SaaS)

| Funcionalidad | Valor | Prioridad |
|---------------|-------|-----------|
| **System User + token de Business** | Tokens que no caducan con un empleado | **P1** (escala) |
| `business_management` | Listar assets del BM del cliente | P1 |
| App Review **Advanced Access** (`ads_read`, `leads_retrieval`, etc.) | Obligatorio si la app opera cuentas de terceros en Live | **P0 ops** |
| Marketing API Access Tier | Cuotas Insights/Management | P0 ops al crecer |

---

## 4. Matriz “¿lo integramos?” (decisión de producto)

| Idea | ¿Encaja en el CRM? | Motivo |
|------|--------------------|--------|
| Backfill leads + catálogo forms | **Sí** | Cierra huecos del webhook; bajo riesgo |
| Insights + CPL en dashboard | **Sí** | Diferenciador vs solo listado de leads |
| CAPI Conversion Leads (calidad) | **Sí** (fase media) | Meta lo empuja; mejora ads del cliente |
| Custom audiences desde CRM | **Sí** (fase media) | Loop cerrado marketing ↔ CRM |
| Pausar campañas desde CRM | Opcional | Útil, no esencial |
| Crear ads/creatives | **No (ahora)** | Competir con Ads Manager |
| WhatsApp inbox | **Sí, módulo aparte** | Alto valor LatAm |
| Messenger/IG inbox | Después de WA o en paralelo ligero | |
| Publicación orgánica FB/IG | **No** | Fuera de visión CRM |

---

## 5. Permisos y App Review (impacto real)

| Scope / feature | Hoy | Para qué ampliar |
|-----------------|-----|------------------|
| `pages_show_list` | ✅ | Listar páginas |
| `pages_manage_metadata` | ✅ | Suscribir webhooks |
| `leads_retrieval` | ✅ | Leer leads |
| `ads_read` | ✅ | Sync ads + **Insights** |
| `pages_manage_ads` | ❌ | Forms / algunos lead edges |
| `pages_read_engagement` | ❌ | Comentarios / engagement |
| `ads_management` | ❌ | Pausar/crear ads; a veces lectura lead enriquecida |
| `business_management` | ❌ | Assets BM / system users |
| `whatsapp_business_messaging` / `_management` | ❌ | WhatsApp Cloud |
| Marketing API Access Tier | Revisar en App Dashboard | Cuotas producción |
| Advanced Access (App Review) | Crítico en Live multi-cliente | Sin esto, solo testers |

**Riesgo SaaS:** cada org trae su Meta App (modelo actual). Eso reparte App Review por cliente, pero complica soporte. Alternativa futura: **una App de plataforma** + System Users / partner integration (más App Review, mejor DX).

---

## 6. Rate limits y operación

- Marketing / Pages con page o system token → **Business Use Case (BUC)** limits (headers `X-Business-Use-Case-Usage`).
- Insights tiene BUC propio; reportes grandes → **async insights**.
- Leadgen bulk tiene límites; preferir webhook + backfill puntual.
- Respuestas `429` → backoff exponencial + cola (hoy sin Redis/BullMQ; PLAN.md §11).

Antes de Insights agresivos o sync horarios: **workers + cola** (fase infra).

---

## 7. Roadmap sugerido (agrupado, no comprometido)

### Oleada A — Consolidar Lead Ads (rápido ROI)

> **Plan de implementación:** [PLAN-FASE-14-META-LEADADS-CONSOLIDAR.md](./PLAN-FASE-14-META-LEADADS-CONSOLIDAR.md)

1. Catálogo `leadgen_forms` por página vinculada.  
2. Backfill / reimport de leads por form o rango de fechas.  
3. Alertas de salud webhook (página sin suscripción / errores Graph).  
4. Unificar versión Graph (`v21` → versión documentada actual).

### Oleada B — Dashboard publicitario

1. Pull Insights por cuenta/campaña (sync diario o on-demand).  
2. KPIs híbridos: spend Meta + leads CRM → **CPL**.  
3. Filtros dashboard por cuenta (ya hay base Fase 13).

### Oleada C — Loop marketing ↔ CRM

1. Estados mínimos de lead (aunque sea `nuevo | contactado | descartado | ganado`).  
2. CAPI Conversion Leads (enviar calidad a Meta con `lead_id`).  
3. Custom Audiences (calientes / excluidos).

### Oleada D — Conversación

1. Módulo WhatsApp Cloud (WABA por org o BSP).  
2. Opcional: Messenger Page inbox.  
3. Atribución click-to-WA.

### Oleada E — Ads ops ligeros (opcional)

1. Pausar/activar campañas.  
2. No construir Ads Manager completo.

---

## 8. Endpoints Graph más relevantes (referencia rápida)

| Uso | Método | Path (patrón) |
|-----|--------|---------------|
| OAuth dialog | GET | `https://www.facebook.com/{ver}/dialog/oauth` |
| Token exchange | GET | `/oauth/access_token` |
| Páginas del user | GET | `/me/accounts` |
| Ad accounts | GET | `/me/adaccounts` |
| Suscripción webhook página | POST | `/{page-id}/subscribed_apps` |
| Lead por id | GET | `/{leadgen-id}` |
| Leads de form | GET | `/{form-id}/leads` |
| Forms de página | GET | `/{page-id}/leadgen_forms` |
| Campañas | GET | `/act_{id}/campaigns` |
| Insights | GET | `/{object-id}/insights` |
| Custom audience | POST | `/act_{id}/customaudiences` |
| CAPI events | POST | `/{pixel-id}/events` (o dataset) |

Versión: parametrizar (`META_GRAPH_VERSION`) y mantener una sola en backend.

---

## 9. Fuera de alcance recomendado (corto–medio plazo)

- Ads Library / transparencia pública.  
- Catalog / Commerce / Shops.  
- Advantage+ shopping creatives API.  
- Marketing Mix Modeling / MMM.  
- Publicación orgánica masiva.  
- Competir con Meta Ads Manager o Business Suite.

---

## 10. Criterios para aceptar una integración nueva

Antes de abrir una fase de código:

1. **¿Resuelve un dolor del usuario del CRM** (agencia / inmobiliaria), no solo “porque la API existe”?  
2. **¿Permisos y App Review** están claros (Standard vs Advanced)?  
3. **¿Cabe en clean architecture** como submódulo Meta o módulo nuevo del catálogo?  
4. **¿Rate limits / jobs** requieren cola? Si sí, planificar infra.  
5. **¿Datos sensibles?** (PII leads, audiencias) → cifrado, retención, consentimiento.

---

## 11. Resumen ejecutivo

| Ya somos buenos en | Siguiente valor más claro | Gran apuesta comercial |
|--------------------|---------------------------|-------------------------|
| OAuth multi-tenant, páginas N, cuentas N, webhook leadgen, leads + dashboard de volumen | Backfill leads + Insights/CPL + forms catalog | WhatsApp + CAPI calidad + audiencias |

El CRM no necesita “toda la Marketing API”. Necesita **cerrar el ciclo Lead Ads → CRM → feedback a Meta → (opcional) conversación**, que es exactamente donde Meta documenta partners CRM y Conversion Leads.

---

## 12. Referencias oficiales

- [Lead Ads](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/)  
- [Retrieving Leads](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/)  
- [Lead Forms for Ads](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/create/)  
- [Ads Insights API](https://developers.facebook.com/docs/marketing-api/insights)  
- [Marketing API Authorization](https://developers.facebook.com/docs/marketing-api/get-started/authorization/)  
- [Graph API Rate Limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/)  
- [Conversions API / Conversion Leads CRM](https://developers.facebook.com/docs/marketing-api/conversions-api/conversion-leads-integration/)  
- [Custom Audiences](https://developers.facebook.com/docs/marketing-api/audiences/guides/custom-audiences)  
- [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)

---

## 13. Enlace desde el plan principal

Al decidir la próxima fase Meta, usar este documento como **menú de opciones** y bajar la oleada elegida a un `PLAN-FASE-XX-….md` concreto (como se hizo con Fase 13).
