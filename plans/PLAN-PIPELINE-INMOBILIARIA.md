# Backlog / spec residual — Pipeline inmobiliaria

Documento residual de producto/ops. **Fases 20–22 (código)** ya absorbidas en [PLAN.md](./PLAN.md) §13 / fase 20 (dominio, API, UI listado/detalle/kanban, campos por transición, visitas/calificaciones, CAPI en cierre).

**Repos:** `back-saas-crm` · `front-saas-crm` · Vertical: **`INMOBILIARIA`**

---

## 1. Reglas de producto vivas

| Principio | Decisión |
|-----------|----------|
| Intención ≠ estado | `tipo_lead` + `estado_gestion` |
| Compra ≠ venta | Misma columna de estado; catálogo/transiciones distintos por tipo |
| Terminales | `CERRADO_GANADO`, `CERRADO_PERDIDO`, `DESCARTADO` (reabrir solo admin) |
| Soft delete | `leads.estado` (0/1) **nunca** mezclar con pipeline |
| Matrices | Código (`pipeline-inmobiliaria.ts`) + override opcional `organizaciones.pipeline_config` (JSON v1) |

**Salida de NUEVO/CONTACTADO hacia etapas avanzadas:** `tipo_lead` definido (`COMPRA`/`VENTA`; `OTRO` = flujo corto).

### Embudo COMPRA

| Código | Etiqueta |
|--------|----------|
| `NUEVO` · `CONTACTADO` · `CALIFICADO` | Nuevo / Contactado / Calificado |
| `VISITA_AGENDADA` · `VISITA_REALIZADA` | Visita agendada / realizada |
| `NEGOCIACION` · `SEPARACION` | Negociación / Separación |
| `CERRADO_GANADO` · `CERRADO_PERDIDO` · `DESCARTADO` | Terminales |

```
NUEVO → CONTACTADO | DESCARTADO
CONTACTADO → CALIFICADO | DESCARTADO
CALIFICADO → VISITA_AGENDADA | NEGOCIACION | DESCARTADO | CERRADO_PERDIDO
VISITA_AGENDADA → VISITA_REALIZADA | CALIFICADO | DESCARTADO | CERRADO_PERDIDO
VISITA_REALIZADA → NEGOCIACION | VISITA_AGENDADA | DESCARTADO | CERRADO_PERDIDO
NEGOCIACION → SEPARACION | CERRADO_GANADO | CERRADO_PERDIDO | DESCARTADO
SEPARACION → CERRADO_GANADO | CERRADO_PERDIDO | NEGOCIACION | DESCARTADO
```

### Embudo VENTA

| Código | Etiqueta |
|--------|----------|
| `NUEVO` · `CONTACTADO` · `CALIFICADO` | Igual |
| `CAPTACION` · `EN_COMERCIALIZACION` | Captación / En comercialización |
| `NEGOCIACION` · `SEPARACION` | Negociación / Separación |
| Terminales | Igual |

```
NUEVO → CONTACTADO | DESCARTADO
CONTACTADO → CALIFICADO | DESCARTADO
CALIFICADO → CAPTACION | DESCARTADO | CERRADO_PERDIDO
CAPTACION → EN_COMERCIALIZACION | DESCARTADO | CERRADO_PERDIDO
EN_COMERCIALIZACION → NEGOCIACION | DESCARTADO | CERRADO_PERDIDO
NEGOCIACION → SEPARACION | CERRADO_GANADO | CERRADO_PERDIDO | DESCARTADO
SEPARACION → CERRADO_GANADO | CERRADO_PERDIDO | NEGOCIACION | DESCARTADO
```

### Embudo OTRO (corto)

`NUEVO` → `CONTACTADO` → `CALIFICADO` → `CERRADO_GANADO` \| `CERRADO_PERDIDO` \| `DESCARTADO`

### Motivos de cierre (código v1)

| Clase | Códigos |
|-------|---------|
| Descartado | `DUPLICADO`, `DATOS_INVALIDOS`, `SPAM`, `NO_INTERESA`, `FUERA_ZONA`, `OTRO` |
| Perdido | `PRECIO`, `COMPETENCIA`, `SIN_RESPUESTA`, `FINANCIAMIENTO`, `RETIRO_CLIENTE`, `OTRO` |
| Ganado | `VENTA_CERRADA`, `COMPRA_CERRADA`, `OTRO` |

### Naming (cerrado)

- API/JSON: `estadoGestion`, `tipoLead`, `motivoCierre` (camelCase)
- BD: `estado_gestion`, `tipo_lead`, `motivo_cierre` (snake_case)
- Códigos de estado: **UPPER_SNAKE** (`VISITA_AGENDADA`); etiquetas solo UI

---

## 2. Operativo pendiente

- [ ] `prisma migrate deploy` en producción (incl. `20260904194500_pipeline_backlog`: inmuebles, FKs, WA flag, `pipeline_config`)
- [ ] Smoke: mover lead COMPRA y VENTA por UI + historial + tablero
- [ ] Dataset CAPI configurado en org si se quiere Conversion Leads en cierres
- [ ] Configurar `WHATSAPP_AGENDA_REMINDER_TEMPLATE` (+ idioma) si se quieren recordatorios WA fuera de ventana 24h

---

## 3. Backlog — checklist post-implementación

| Ítem | Estado |
|------|--------|
| **Fase 23** — Agenda + recordatorios | **Hecho en código**: UI `/agenda`, visitas + actividades, cron in-app + **WA al lead** (sesión 24h o plantilla env) |
| **Fase 24** — Actividades / próxima acción | **Hecho**: `lead_actividades` + bloque «Próxima acción» en ficha lead |
| **Fase 25** — Catálogo inmuebles | **Hecho**: CRUD `/inmuebles`, vínculo visita/`inmuebleInteresId`; `referencia_inmueble` texto se mantiene |
| Dashboard KPIs embudo | **Hecho**: `GET /dashboard/embudo-kpis` + sección Embudo en `/dashboard` |
| Heurística `tipo_lead` desde `field_data` | **Hecho**: solo si `tipoLead` null en ingest Meta |
| Pipelines configurables por org | **Hecho (v1 JSON)**: `pipeline_config` + settings UI; meta/tablero respetan override |

---

## 4. Fuera de alcance (sigue vigente)

- Multirubro (médicos, etc.)
- Comisiones / proformas
- Automatizar estado solo porque llegó un WhatsApp
- Forzar transiciones fuera de matriz
- Editor visual de pipeline (solo JSON/form v1)

**Ya no fuera de alcance:** kanban (`/leads/tablero`) y CAPI en código (requiere dataset en org) — ver PLAN.md §13.

---

*Código 20–25 + backlog embudo/WA/heurística/pipeline JSON cerrado en código. Este archivo = spec de embudos + ops residual.*
