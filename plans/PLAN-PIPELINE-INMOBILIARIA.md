# Subplan — Pipeline profesional de leads (Inmobiliaria)

Documento hijo de [PLAN.md](./PLAN.md). Extiende fases 17–19 (rubro, asignación, WhatsApp).

**Repos:** `back-saas-crm` · `front-saas-crm`  
**Vertical:** solo **`INMOBILIARIA`**  
**Prerrequisito:** leads Meta + `tipo_lead` + asignación (Fases 17–18) operativos.

---

## 1. Objetivo

Pasar de “lead capturado / asignado / chateado” a un **pipeline de gestión profesional** que:

1. Distingue **intención**: `COMPRA` vs `VENTA` (y `OTRO`).
2. Usa **estados claros**, con transiciones válidas (no un combo libre sin reglas).
3. Deja **trazabilidad** (quién cambió, cuándo, desde/hacia, motivo).
4. Sirve al asesor diario y a reportes (embudo, conversión, tiempos).

```
Lead Meta
   │
   ▼
NUEVO (sin dueño o recién tomado)
   │  tipo_lead = COMPRA | VENTA | OTRO
   ▼
Pipeline según tipo ──► CERRADO_GANADO
                     ├─► CERRADO_PERDIDO
                     └─► DESCARTADO
```

---

## 2. Principios de diseño

| Principio | Decisión |
|-----------|----------|
| Intención ≠ estado | `tipo_lead` ya existe; el pipeline es `estado_gestion` |
| Un lead, un tipo | 1 valor de `tipo_lead` a la vez; cambio de tipo auditado (admin o dueño) |
| Compra ≠ venta | **Misma columna de estado**, **catálogo y transiciones distintos** por tipo |
| Estados terminales | `CERRADO_GANADO`, `CERRADO_PERDIDO`, `DESCARTADO` no avanzan (salvo reapertura admin) |
| Soft delete intacto | `leads.estado` (0/1) sigue siendo baja lógica; **nunca** mezclar con pipeline |
| Asignación previa | Ideal: trabajar pipeline solo con lead **asignado**; admin puede forzar |
| Sin kanban obligatorio en v1 | Listado + detalle + filtros; tablero opcional en fase posterior |
| Sin oportunidades/deals aún | No montos/comisiones en v1 (campo opcional futuro) |

---

## 3. Modelo mental: dos embudos, un motor

### 3.1 `tipo_lead` (ya existe — Fase 18)

| Valor | Significado | Ejemplo de origen |
|-------|-------------|-------------------|
| `COMPRA` | Quiere adquirir / invertir | Form “presupuesto”, “visita” |
| `VENTA` | Quiere vender / captar inmueble | Form “tasación”, “vendo mi depto” |
| `OTRO` | No clasificado / consulta mixta | Manual o heurística fallida |
| `null` | Aún sin clasificar | Lead recién llegado |

**Regla de producto:** para salir de `NUEVO` / `CONTACTADO` hacia etapas avanzadas, **`tipo_lead` debe estar definido** (`COMPRA` o `VENTA`; `OTRO` solo usa flujo corto).

### 3.2 Embudo **COMPRA** (comprador / inversionista)

| Código | Etiqueta UI | Qué significa |
|--------|-------------|---------------|
| `NUEVO` | Nuevo | Entró al CRM; sin gestión o recién tomado |
| `CONTACTADO` | Contactado | Primer contacto (WA/llamada/mail) hecho |
| `CALIFICADO` | Calificado | Presupuesto, zona, plazo, intención claros |
| `VISITA_AGENDADA` | Visita agendada | Cita a proyecto / reunión virtual |
| `VISITA_REALIZADA` | Visita realizada | Ya visitó o reunió |
| `NEGOCIACION` | Negociación | Propuesta / contraoferta / evaluación |
| `SEPARACION` | Separación / reserva | Seña o proceso de separación |
| `CERRADO_GANADO` | Cerrado ganado | Compró / firmó |
| `CERRADO_PERDIDO` | Cerrado perdido | No compró (competencia, precio, etc.) |
| `DESCARTADO` | Descartado | Inválido, spam, no interesa, duplicado |

### 3.3 Embudo **VENTA** (propietario que vende)

| Código | Etiqueta UI | Qué significa |
|--------|-------------|---------------|
| `NUEVO` | Nuevo | Igual |
| `CONTACTADO` | Contactado | Igual |
| `CALIFICADO` | Calificado | Tipo de inmueble, zona, expectativa de precio, docs |
| `CAPTACION` | Captación | Acuerdo de intermediación / datos del inmueble |
| `EN_COMERCIALIZACION` | En comercialización | Publicado / en cartera activa |
| `NEGOCIACION` | Negociación | Ofertas de compradores |
| `SEPARACION` | Separación / reserva | Proceso de cierre con comprador |
| `CERRADO_GANADO` | Cerrado ganado | Venta concretada (vía la inmobiliaria) |
| `CERRADO_PERDIDO` | Cerrado perdido | Vendió por otro / retiró / no cerró |
| `DESCARTADO` | Descartado | Igual |

### 3.4 Embudo **OTRO** (corto)

`NUEVO` → `CONTACTADO` → `CALIFICADO` → `CERRADO_GANADO` \| `CERRADO_PERDIDO` \| `DESCARTADO`  
(sin visitas / captación / comercialización).

### 3.5 Por qué no un solo listado lineal antiguo

El esquema corto `NUEVO → CONTACTADO → EN_GESTION → CERRADO` **no diferencia**:

- comprador en visita vs propietario en captación  
- ganado vs perdido (ambos eran “CERRADO”)  
- descarte vs pérdida comercial  

El diseño de §3.2–3.3 sí permite embudos y KPIs serios.

---

## 4. Transiciones (máquina de estados)

### 4.1 Reglas generales

1. Solo se permiten arcos definidos para el `tipo_lead` actual.
2. Desde casi cualquier estado **no terminal** se puede ir a `DESCARTADO` (con motivo).
3. A `CERRADO_GANADO` / `CERRADO_PERDIDO` solo desde etapas “avanzadas” (ver matrices).
4. **Reabrir** (terminal → `CONTACTADO` o `CALIFICADO`): solo `PROPIETARIO` / `ADMINISTRADOR`.
5. Cambio de `tipo_lead` con pipeline avanzado: advertencia; si hay historial, se registra evento `CAMBIO_TIPO` y el estado vuelve a `CONTACTADO` o se mantiene solo si el código existe en ambos embudos (`NUEVO`, `CONTACTADO`, `CALIFICADO`, `NEGOCIACION`, `SEPARACION`, terminales).

### 4.2 Matriz COMPRA (resumen)

```
NUEVO → CONTACTADO | DESCARTADO
CONTACTADO → CALIFICADO | DESCARTADO | (re-contacto se queda)
CALIFICADO → VISITA_AGENDADA | NEGOCIACION | DESCARTADO | CERRADO_PERDIDO
VISITA_AGENDADA → VISITA_REALIZADA | CALIFICADO | DESCARTADO | CERRADO_PERDIDO
VISITA_REALIZADA → NEGOCIACION | VISITA_AGENDADA | DESCARTADO | CERRADO_PERDIDO
NEGOCIACION → SEPARACION | CERRADO_GANADO | CERRADO_PERDIDO | DESCARTADO
SEPARACION → CERRADO_GANADO | CERRADO_PERDIDO | NEGOCIACION | DESCARTADO
```

### 4.3 Matriz VENTA (resumen)

```
NUEVO → CONTACTADO | DESCARTADO
CONTACTADO → CALIFICADO | DESCARTADO
CALIFICADO → CAPTACION | DESCARTADO | CERRADO_PERDIDO
CAPTACION → EN_COMERCIALIZACION | DESCARTADO | CERRADO_PERDIDO
EN_COMERCIALIZACION → NEGOCIACION | DESCARTADO | CERRADO_PERDIDO
NEGOCIACION → SEPARACION | CERRADO_GANADO | CERRADO_PERDIDO | DESCARTADO
SEPARACION → CERRADO_GANADO | CERRADO_PERDIDO | NEGOCIACION | DESCARTADO
```

Las matrices viven en **código** (`shared/domain/pipeline-inmobiliaria.ts`), no en BD en v1 (configurable por org = fase futura).

---

## 5. Modelo de datos

### 5.1 Ampliar `leads`

| Campo | Tipo | Notas |
|-------|------|--------|
| `estado_gestion` | VARCHAR(40) NOT NULL DEFAULT `'NUEVO'` | Código del pipeline |
| `estado_gestion_en` | TIMESTAMPTZ NULL | Último cambio de estado |
| `estado_gestion_por_usuario_id` | UUID NULL | Quién hizo el último cambio |
| `motivo_cierre` | VARCHAR(80) NULL | Catálogo corto (ganado/perdido/descartado) |
| `nota_cierre` | VARCHAR(500) NULL | Texto libre opcional |

Índices: `INDEX(organizacion_id, estado_gestion)`, `INDEX(organizacion_id, tipo_lead, estado_gestion)`.

Default al **ingestar** desde Meta: `estado_gestion = 'NUEVO'`.

### 5.2 Historial `lead_estado_historial`

| Columna | Notas |
|---------|--------|
| `id` | UUID |
| `organizacion_id` | FK lógica |
| `lead_id` | FK |
| `tipo_lead` | Snapshot del tipo en el momento |
| `desde` | VARCHAR nullable (null = alta) |
| `hacia` | VARCHAR NOT NULL |
| `motivo_cierre` | nullable |
| `nota` | nullable — nota de transición o de cierre |
| `metadata` | JSONB nullable — datos estructurados (visita, calificación, etc.) |
| `usuario_id` | quién cambió (null = sistema) |
| auditoría estándar | `estado`, fechas, etc. |

Índice: `(lead_id, fecha_creacion)`.

### 5.3 Motivos de cierre (catálogo en código v1)

**Descartado:** `DUPLICADO`, `DATOS_INVALIDOS`, `SPAM`, `NO_INTERESA`, `FUERA_ZONA`, `OTRO`  
**Perdido:** `PRECIO`, `COMPETENCIA`, `SIN_RESPUESTA`, `FINANCIAMIENTO`, `RETIRO_CLIENTE`, `OTRO`  
**Ganado:** `VENTA_CERRADA`, `COMPRA_CERRADA`, `OTRO` (según tipo)

---

## 6. Autorización

| Acción | PROPIETARIO / ADMIN | USUARIO (dueño) | USUARIO (no dueño) |
|--------|---------------------|-----------------|---------------------|
| Ver lead / historial | Sí (todos) | Solo asignados + pool | No |
| Cambiar `estado_gestion` | Sí | Sí, si es dueño | No |
| Cambiar `tipo_lead` | Sí | Sí, si es dueño (con reglas) | No |
| Reabrir terminal | Sí | No | No |
| Forzar transición fuera de matriz | No en v1 | No | No |

Misma visibilidad de listado que Fase 18.

---

## 7. APIs (borrador)

| Método | Ruta | Body / query | Notas |
|--------|------|--------------|--------|
| GET | `/leads` | `estadoGestion`, `tipoLead`, … | Filtros embudo |
| GET | `/leads/:id` | — | Incluye estado + últimos cambios |
| GET | `/leads/:id/historial-estados` | — | Timeline |
| PATCH | `/leads/:id/gestion` | `tipoLead?`, `estadoGestion?`, `motivoCierre?`, `notaCierre?`, `notaTransicion?`, `metadata?` | Valida matriz + campos por estado destino |
| GET | `/leads/pipeline/meta` | `tipoLead?` | Catálogo estados/motivos/transiciones + `camposAlEntrar` por estado |

Errores claros: `400` transición inválida, `403` no dueño, `409` si se exige tipo y falta.

---

## 8. UI / UX

### 8.1 Listado `/leads`

- Columnas: **Tipo** (Compra/Venta), **Estado** (badge por etapa), Asignado, …
- Filtros: tipo, estado, “abiertos” (no terminales), “cerrados”, mis leads / pool.
- Color semántico: abierto (neutro), ganado (éxito), perdido/descartado (muted/danger).

### 8.2 Detalle `/leads/[id]`

- Bloque **Gestión**:
  - Selector de tipo (Compra / Venta / Otro) si aún editable.
  - Estado actual + botones/select de **próximos estados permitidos** (no lista completa confusa).
  - Motivo + nota al cerrar/descartar.
- Timeline de historial (compacto).
- CTA WhatsApp existente se mantiene.

### 8.3 Copy por tipo

El front pide `/leads/pipeline/meta?tipoLead=COMPRA|VENTA` y pinta etiquetas correctas (`Captación` vs `Visita agendada`).

### 8.4 Fuera de v1 UI (histórico)

- SLA / colores por días estancado.
- Catálogo de inmuebles vinculado (m², precio pedido en entidad Property).

### 8.5 Campos por transición (Fase 21 — implementado)

Al avanzar el pipeline, el asesor completa un formulario según el **estado destino**. El catálogo vive en `shared/domain/campos-transicion-pipeline.ts` (no en BD). El front lo obtiene de `GET /leads/pipeline/meta` → `estados[].camposAlEntrar`.

**Principios (alineados con CRMs inmobiliarios — HubSpot stage conditions, Pipedrive, etc.):**

1. Cada transición relevante deja **nota** en `lead_estado_historial.nota`.
2. Datos estructurados (fecha visita, inmueble, resultado) van en `metadata` JSONB.
3. El backend **rechaza** el PATCH si faltan campos obligatorios o la transición/tipoLead no es válida.
4. Estados terminales siguen usando `motivoCierre` + `notaCierre` (sin metadata obligatoria).

#### Matriz COMPRA — campos al entrar

| Estado destino | Obligatorio | Opcional |
|----------------|-------------|----------|
| `CONTACTADO` | — | canal de contacto, nota |
| `CALIFICADO` | nota | presupuesto, zona, tipo inmueble |
| `VISITA_AGENDADA` | fecha/hora visita, inmueble/proyecto | modalidad (presencial/virtual), nota |
| `VISITA_REALIZADA` | resultado (asistió / no-show / cancelada), nota | — |
| `NEGOCIACION`, `SEPARACION` | nota | monto referencia |

#### Matriz VENTA — campos al entrar

| Estado destino | Obligatorio | Opcional |
|----------------|-------------|----------|
| `CONTACTADO` | — | canal, nota |
| `CALIFICADO` | nota | tipo propiedad, zona, precio esperado |
| `CAPTACION` | nota | dirección, precio pedido |
| `EN_COMERCIALIZACION` | nota | — |
| `NEGOCIACION`, `SEPARACION` | nota | monto referencia |

#### Matriz OTRO

| Estado destino | Obligatorio | Opcional |
|----------------|-------------|----------|
| `CONTACTADO` | — | canal, nota |
| `CALIFICADO` | nota | — |

#### UI

- Detalle `/leads/[id]`: modal al elegir próximo estado (y al reabrir).
- Tablero `/leads/tablero`: mismo modal al soltar en columna.
- Timeline muestra nota + metadata legible.

#### Arquitectura de datos (profesional)

| Capa | Tabla | Rol |
|------|-------|-----|
| Auditoría | `lead_estado_historial` | Quién/cuándo/desde→hacia + nota breve + metadata ligera (canal, monto ref.) |
| Agenda | **`lead_visitas`** | Fuente de verdad para calendario, recordatorios, show-rate |
| Calificación | **`lead_calificaciones`** | Snapshots de presupuesto/zona/tipo al calificar |
| Futuro | `lead_actividades` | Tareas con fecha (Fase 23) |
| Futuro | `inmuebles` / `listings` | Catálogo de propiedades (Fase 24) |

Al pasar a `VISITA_AGENDADA` se crea fila en `lead_visitas` (no solo JSON).  
API agenda: `GET /leads/visitas/agenda?desde=&hasta=&asignado=`.

#### Fases futuras

- **Fase 23:** UI calendario `/agenda` + recordatorios WhatsApp.
- **Fase 24:** `LeadActividad` + próxima acción.
- **Fase 25:** catálogo de inmuebles (`Property` / `Listing`).

---

## 9. Fases de entrega

### Fase 20.1 — Dominio + persistencia

- Constantes COMPRA/VENTA/OTRO + matrices + motivos.
- Migración `estado_gestion*` + `lead_estado_historial`.
- Ingest Meta: default `NUEVO`.
- Backfill: leads existentes → `NUEVO` (o `CONTACTADO` si ya tienen asignado — decisión: **si `asignado_usuario_id` not null → `CONTACTADO`, else `NUEVO`**).

**Done:** migración + build; sin UI aún o UI mínima de lectura.

### Fase 20.2 — API gestión + historial

- Extender `PATCH .../gestion` con validación de transiciones.
- Endpoints historial + meta de pipeline.
- Tests unitarios de matrices (compra/venta/otro).

**Done:** Postman/HTTP puede mover un lead COMPRA y VENTA por caminos válidos; inválidos 400.

### Fase 20.3 — UI listado + detalle

- Badges, filtros, selector de próximos estados, motivos, timeline.
- Copy dual compra/venta.

**Done:** un asesor gestiona el embudo solo desde la UI.

### Fase 20.4 — (Opcional) Tablero kanban

- Columnas por estado filtradas por tipo.
- Mismo PATCH por debajo.

### Fase 20.5 — (Después) CAPI / calidad

- Mapear `CERRADO_GANADO` / `CERRADO_PERDIDO` / `DESCARTADO` → eventos Conversion Leads.  
  Requiere [INVESTIGACION-META-API.md](./INVESTIGACION-META-API.md) Oleada C.

### Fase 22 — Entidades estructuradas (visitas + calificaciones)

- Tablas `lead_visitas`, `lead_calificaciones`.
- Crear/cerrar visita al transicionar pipeline (misma transacción que historial).
- APIs: `GET /leads/visitas/agenda`, `GET /leads/:id/visitas`.
- UI: panel “Visitas y agenda” en detalle del lead.

**Done:** código + migración `20260901183000`.

### Fase 21 — Campos por transición + notas de seguimiento

- Dominio `campos-transicion-pipeline.ts` + validación en `ActualizarGestionLeadUseCase`.
- Migración `metadata JSONB` en `lead_estado_historial`.
- DTO: `notaTransicion`, `metadata`.
- Meta API: `camposAlEntrar` por estado + `camposReapertura`.
- UI: modal en detalle y kanban; timeline con metadata.

**Done:** build back + front; tests dominio campos-transicion.

---

## 10. KPIs que desbloquea (sin implementar dashboard aún)

| KPI | Definición simple |
|-----|-------------------|
| Tasa de contacto | `CONTACTADO+` / leads del periodo |
| Tasa de calificación | `CALIFICADO+` / contactados |
| Conversión ganados | `CERRADO_GANADO` / leads abiertos o totales |
| Embudo por tipo | Mismos KPIs split `COMPRA` vs `VENTA` |
| Tiempo en etapa | `estado_gestion_en` / historial |

Dashboard dedicado = fase posterior (reusar `/dashboard` o vista embudo).

---

## 11. Relación con lo existente

| Pieza actual | Rol en este subplan |
|--------------|---------------------|
| `organizaciones.rubro = INMOBILIARIA` | Activa este catálogo |
| `tipo_lead` | Eje compra/venta |
| Asignación | Dueño opera el pipeline |
| WhatsApp | Canal; no sustituye el estado (el asesor marca “Contactado”) |
| `datos_crudos` / field_data | Sugerir tipo al ingest (heurística opcional Fase 20.2+) |

Heurística opcional: palabras en preguntas (`presupuesto`, `visita` → COMPRA; `vendo`, `tasación` → VENTA). Nunca bloquea el webhook.

---

## 12. Fuera de alcance (este subplan)

- Pipelines por org configurables en UI.
- Multirubro (médicos, etc.).
- Comisiones, proformas, inventario de inmuebles.
- Automatizar cambio de estado solo porque llegó un WhatsApp.
- Kanban (salvo 20.4).
- CAPI (20.5).

---

## 13. Checklist de cierre

### 20.1
- [x] Migración campos + historial
- [x] Defaults en ingest + backfill
- [x] Dominio matrices compra/venta/otro

### 20.2
- [x] PATCH gestión con validación
- [x] Historial + meta pipeline
- [x] Tests de transiciones (22 tests)
- [x] `npm run build` back

### 20.3
- [x] UI listado (tipo + estado + filtros)
- [x] UI detalle (próximos estados + motivos + timeline)
- [x] `npm run build` front

### 20.4 / 20.5
- [x] Tablero kanban (`/leads/tablero`, drag → mismo PATCH gestión)
- [x] CAPI en código (`EnviarEventoConversionLeadUseCase` — requiere dataset CAPI configurado en org)

### 21 — Campos por transición
- [x] Dominio + validación PATCH gestión
- [x] Migración `metadata` historial
- [x] Meta API `camposAlEntrar`
- [x] UI modal detalle + kanban + timeline
- [x] `npm run build` back + front

### 22 — Visitas y calificaciones (tablas)
- [x] `lead_visitas` + `lead_calificaciones`
- [x] Sincronización al cambiar estado pipeline
- [x] API agenda + listado por lead
- [x] Panel visitas en detalle lead

### Operativo pendiente
- [ ] `prisma migrate deploy` en producción (incl. `20260901181500`, `20260901183000`)
- [ ] Smoke: mover lead COMPRA y VENTA por UI + ver historial
- [ ] Heurística opcional `tipo_lead` desde `field_data` (no bloqueante)

---

## 14. Decisión de naming (cerrada)

- API/JSON: `estadoGestion`, `tipoLead`, `motivoCierre` (camelCase).
- BD: `estado_gestion`, `tipo_lead`, `motivo_cierre` (snake_case).
- Códigos de estado: **UPPER_SNAKE** estables (`VISITA_AGENDADA`), etiquetas solo en UI/i18n.

---

*Plan profesional inmobiliario: embudos COMPRA y VENTA sobre un motor común de estados + historial. **Código 20.1–21 cerrado** — pendiente deploy migraciones + smoke en prod.*
