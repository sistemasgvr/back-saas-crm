# Subplan — Gestión de leads por rubro + asignación + WhatsApp

Documento hijo de [PLAN.md](./PLAN.md). Complementa (no reemplaza) la captura Meta Lead Ads ya implementada.

**Repos:** `back-saas-crm` · `front-saas-crm`  
**Arquitectura:** misma (clean architecture / frontend modular / multi-tenant por `organizacion_id`)  
**Prerrequisito:** MVP Meta + leads (fases 0–16) operativo; webhook/backfill ya entregan leads.

---

## 1. Objetivo

Pasar de **solo capturar leads** a **poder trabajarlos en el CRM**, **solo para el rubro inmobiliario** en esta oleada:

1. Organización con rubro **`INMOBILIARIA`** (único vertical soportado por ahora).
2. Distinguir intención cuando haga falta (`COMPRA` / `VENTA`).
3. **Asignación / toma** del lead por usuarios de la empresa.
4. **Chat WhatsApp centralizado** ligado al lead, con visibilidad por rol.

**Meta de esta oleada:** inmobiliaria → asignar/tomar → **chatear**.  
**No incluido aún:** otros rubros (médicos, etc.), pipeline de estados. Eso va después.

```
Lead Meta (webhook)
        │
        ▼
   Pool org (sin dueño)
        │
   ┌────┴────┐
   │ tomar / │ asignar
   └────┬────┘
        ▼
  Lead asignado
        │
        ▼
  Conversación WhatsApp (Cloud API)
        │
   admin: todos los chats
   usuario: solo los suyos
```

---

## 2. Problema que resuelve

Hoy el lead es un registro de captura (contacto + origen ads + `field_data`). Falta:

| Hueco | Impacto |
|-------|---------|
| Sin rubro / vertical | No hay copy ni reglas específicas de inmobiliaria |
| Sin dueño | Nadie “trabaja” el lead; no hay accountability |
| Sin canal de seguimiento | El teléfono queda en ficha; el chat vive fuera del CRM |

**Alcance vertical:** solo **inmobiliaria**. Otros rubros y el **pipeline de estados** quedan fuera hasta cerrar chat en este vertical.

---

## 3. Decisiones de producto (cerradas para este subplan)

| Tema | Decisión |
|------|----------|
| Vertical de esta oleada | **Solo `INMOBILIARIA`** — no se construyen flujos de otros rubros |
| Dónde vive el rubro | Columna en `organizaciones` |
| Quién define el rubro | Admin de plataforma al crear/editar empresa |
| Valor soportado | `INMOBILIARIA` (único con UI/reglas). Otros valores del enum quedan reservados, sin producto |
| Rubros futuros | Fuera de alcance (p. ej. `MEDICOS_DOMICILIO`) — no G1–G3 |
| Intención del lead (`tipo_lead`) | Inmobiliaria: `COMPRA` \| `VENTA` \| `OTRO` (opcional en G2) |
| **Pipeline de estados** | **Diferido** — no en G1–G3 |
| Asignación | 1 lead → 1 usuario de la org (v1). Sin cola round-robin automática aún |
| Toma vs asignar | **Tomar:** usuario se autoasigna si está libre. **Asignar:** `PROPIETARIO` / `ADMINISTRADOR` elige destinatario |
| Reasignar | Solo admin/propietario (v1) |
| WhatsApp | **Cloud API** oficial (Meta). No WhatsApp Web scrape |
| Número WA | **1 línea por organización** en v1 |
| Primer mensaje | Plantilla aprobada (fuera de ventana 24h) |
| Módulo feature flag | Activar `WHATSAPP` cuando se implemente la fase chat |
| Roles | Reusar `PROPIETARIO` \| `ADMINISTRADOR` \| `USUARIO` |

### Visibilidad (leads y chats)

| Rol | Leads | Chats WA |
|-----|-------|----------|
| `PROPIETARIO` | Todos de la org | Todos |
| `ADMINISTRADOR` | Todos de la org | Todos |
| `USUARIO` | Solo asignados a él (+ pool “sin asignar” para poder **tomar**) | Solo de leads asignados a él |

> Pool visible a `USUARIO` solo en modo “disponibles para tomar”, no el historial de leads ajenos.

---

## 4. Modelo de datos (propuesto)

### 4.1 `organizaciones` — ampliación

| Campo | Tipo | Notas |
|-------|------|--------|
| `rubro` | VARCHAR(40) NOT NULL DEFAULT `'INMOBILIARIA'` | En producto solo se opera `INMOBILIARIA`. Otros códigos reservados, sin features |

Índice: `INDEX(rubro)`.

> Orgs que no sean inmobiliaria: pueden existir en BD, pero **esta oleada no implementa** su flujo de gestión ni copy específico.

### 4.2 `leads` — ampliación CRM (sin romper captura Meta)

| Campo | Tipo | Notas |
|-------|------|--------|
| `tipo_lead` | VARCHAR(40) NULL | Opcional; inmobiliaria: `COMPRA` \| `VENTA` \| `OTRO` |
| `asignado_usuario_id` | UUID NULL | Usuario dueño del lead |
| `asignado_en` | TIMESTAMPTZ NULL | |
| `asignado_por_usuario_id` | UUID NULL | Quién asignó (null si se auto-tomó) |

Índices: `INDEX(asignado_usuario_id)`, `INDEX(tipo_lead)`.

**No en esta oleada:** `estado_gestion` ni flujo  
`NUEVO → CONTACTADO → EN_GESTION → CERRADO | DESCARTADO`  
(queda para **G5 — Pipeline**, cuando el chat ya esté operativo).

### 4.3 WhatsApp (Fase G3)

| Tabla | Rol |
|-------|-----|
| `whatsapp_conexiones` | WABA / phone_number_id / tokens cifrados por org |
| `whatsapp_conversaciones` | 1 conversación por lead (o por `wa_id` + org) |
| `whatsapp_mensajes` | Historial (in/out, plantilla, status delivery) |

Reglas:

- Toda fila con `organizacion_id`.
- Conversación preferentemente `lead_id` NOT NULL cuando nace desde un lead.
- Idempotencia por `wamid` / id Meta en mensajes.

---

## 5. Fases de entrega

### Fase G1 — Rubro inmobiliario en organización

**Backend**

- Migración `organizaciones.rubro` (default `INMOBILIARIA`).
- Admin plataforma: create/update org; selector con **Inmobiliaria** como opción operativa (o valor fijo por ahora).
- Org activa expone `rubro`.

**Frontend**

- `/admin/organizations` create/edit: rubro (inmobiliaria).
- Copy de leads/gestión asume inmobiliaria.

**Done cuando:** empresas del piloto quedan como `INMOBILIARIA` y el sistema lo lee.

---

### Fase G2 — Asignación del lead (+ tipo opcional)

**Backend**

- Migración: `asignado_*` (+ `tipo_lead` si se incluye).
- Use cases:
  - `tomar-lead` (solo si libre; race-safe).
  - `asignar-lead` (admin/propietario).
  - `reasignar-lead` / `liberar-lead` (admin).
  - (Opcional) `actualizar-tipo-lead`.
- Listado: filtros “mis leads”, “sin asignar”, asignado; **sin** filtro de pipeline.
- Autorización por rol (§3).

**Frontend**

- `/leads`: columna asignado; acciones Tomar / Asignar.
- `/leads/[id]`: dueño (+ tipo si aplica) + respuestas Meta; CTA listo para G3 (“Iniciar chat”).
- Sin UI de estados de gestión.

**Done cuando:** un `USUARIO` toma un lead libre; un admin asigna; el listado respeta visibilidad.

**Fuera de G2:** WhatsApp, **pipeline de estados**, SLA, scoring.

---

### Fase G3 — WhatsApp Cloud API (inbox) ← meta de esta oleada

**Prerrequisitos Meta**

- Producto WhatsApp / WABA.
- Número verificado; plantillas aprobadas.
- Webhook mensajes → backend.
- Módulo `WHATSAPP` habilitado en la org.

**Backend**

- Conexión / credenciales por org.
- Webhook mensajes + estados de entrega.
- Enviar plantilla (primer contacto) y mensajes de sesión (ventana 24h).
- Vincular conversación ↔ lead (teléfono E.164).
- Permisos: admin ve todo; usuario solo chats de leads asignados.

**Frontend**

- Inbox `/chats` o `/whatsapp`.
- Desde ficha lead: “Abrir / iniciar chat”.
- No leídos (mínimo viable).

**Done cuando:** lead asignado → chat en CRM → respuesta del cliente visible; roles respetados.

**Fuera de G3:** multimúmero, bots, IA, pipeline de estados.

---

### Fase G4 — Otros rubros 🔜 (fuera de esta oleada)

No se implementa. Cuando haya un segundo vertical (p. ej. médicos a domicilio), se abrirá un subplan propio. **G1–G3 asumen solo inmobiliaria.**

---

### Fase G5 — Pipeline de estados (después del chat) 🔜

Cuando el equipo inmobiliario ya chatee con leads de forma estable:

- Campo `estado_gestion` en `leads`.
- Flujo inicial inmobiliaria:  
  `NUEVO → CONTACTADO → EN_GESTION → CERRADO | DESCARTADO`
- UI + filtros.

**No abrir G5 hasta cerrar G3.**

---

## 6. APIs (borrador)

| Método | Ruta | Quién | Descripción |
|--------|------|-------|-------------|
| PATCH | admin org | Admin plataforma | Incluye `rubro` |
| POST | `/leads/:id/claim` | USUARIO+ | Tomar lead libre |
| POST | `/leads/:id/assign` | ADMIN/PROPIETARIO | Body `{ usuarioId }` |
| POST | `/leads/:id/release` | ADMIN/PROPIETARIO | Liberar |
| PATCH | `/leads/:id/gestion` | Dueño o admin | Solo `tipoLead` (sin estado) en G2 |
| GET | `/leads` | Según rol | Filtros asignación |
| GET/POST | `/whatsapp/...` | Fase G3 | Conexión, conversaciones, enviar |

Webhook WhatsApp: público, firma Meta (patrón leadgen).

---

## 7. UI (mapa)

| Ruta | Fase | Notas |
|------|------|-------|
| `/admin/organizations` · new/edit | G1 | Campo rubro |
| `/leads` | G2 | Pool / mis leads |
| `/leads/[id]` | G2 | Asignación + (G3) CTA chat |
| `/whatsapp` o `/chats` | G3 | Inbox |
| `/settings/whatsapp` | G3 | Conexión WABA |

Reutilizar componentes existentes. Sin cards infladas.

---

## 8. Relación con PLAN.md e investigación Meta

| Tema | Documento |
|------|-----------|
| Captura Lead Ads / webhook | [PLAN.md](./PLAN.md) §8 |
| WhatsApp en catálogo API | [INVESTIGACION-META-API.md](./INVESTIGACION-META-API.md) Oleada D |
| Este subplan | Asignación + inbox (pipeline después) |

---

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Carrera al “tomar” el mismo lead | Update condicional `WHERE asignado_usuario_id IS NULL` + transacción |
| Scope creep de pipeline | Diferido a G5; no meter estados en G2/G3 |
| WhatsApp bloqueado por plantillas / verificación | Checklist Meta antes de codear inbox |
| Teléfono mal formateado vs WA | Normalizar E.164 al abrir chat |
| Scope creep por rubro | **Solo inmobiliaria** en G1–G3; no abrir médicos/otros |

---

## 10. Orden de implementación

1. **G1** rubro = inmobiliaria.
2. **G2** tomar / asignar (+ tipo compra/venta).
3. **G3** WhatsApp (chatear con el lead).
4. **G5** pipeline de estados (después de G3 en uso).
5. Otros rubros: **no** en esta oleada.

---

## 11. Checklist de cierre

### G1
- [ ] Columna `rubro` (default `INMOBILIARIA`) + migración
- [ ] Admin marca/crea org inmobiliaria
- [ ] API/UI leen rubro; flujos asumen inmobiliaria

### G2
- [ ] Campos asignación (+ `tipo_lead` COMPRA/VENTA)
- [ ] Claim / assign / release + auth por rol
- [ ] Listado: mis leads / sin asignar; usuario no ve ajenos (salvo pool)
- [ ] **Sin** UI de estados de gestión
- [ ] Build back + front OK

### G3
- [ ] Módulo `WHATSAPP` activable
- [ ] Cloud API + webhook mensajes
- [ ] Inbox + vínculo a lead
- [ ] Visibilidad por rol
- [ ] Build back + front OK

### G4 — otros rubros
- [ ] Diferido (no esta oleada)

### G5 (después)
- [ ] `estado_gestion` + flujo inmobiliaria
- [ ] Filtros / UI de pipeline

---

## 12. Fuera de alcance (explícito en esta oleada)

- **Cualquier rubro distinto de inmobiliaria** (médicos, genérico con flujo propio, etc.).
- **Pipeline** `NUEVO → CONTACTADO → EN_GESTION → CERRADO | DESCARTADO` (→ G5).
- Auto-asignación por carga / horarios / territories.
- CRM tipo oportunidades / montos.
- WhatsApp no oficial / multi-device personal.
- Sustituir webhook de leads por cron.
- App móvil nativa.
- Billing.

---

*Alcance acordado: **solo inmobiliaria** → asignar/tomar → chatear. Otros rubros y pipeline después.*
