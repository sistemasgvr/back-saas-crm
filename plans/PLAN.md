# Plan de construcción — SaaS CRM (MVP)

Documento de planificación del producto. No se implementa todo a la vez: cada fase tiene un entregable cerrado y un criterio de “done”.

**Repos:** `back-saas-crm` (NestJS) · `front-saas-crm` (Next.js)  
**Stack objetivo:** NestJS 11 + Prisma + **Neon PostgreSQL** · Next.js 16 + React 19 + Tailwind 4  
**Arquitectura:** backend en **clean architecture** por módulo · frontend **modular** (rutas delgadas + módulos de feature + componentes reutilizables)  
**UI:** copiar componentes desde `front-saas-crm/free-nextjs-admin-dashboard-main` hacia nuestra estructura (no montar la plantilla como app)

---

## 1. Visión del MVP

Un SaaS multiempresa donde **tú** administras la plataforma y **cada cliente** opera solo sus datos.

```
                    TU SAAS
                       │
             ┌─────────▼─────────┐
             │ Administrador     │
             │     SaaS          │
             └─────────┬─────────┘
                       │
                Gestiona empresas
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
     Empresa A      Empresa B      Empresa C
         │             │             │
      Módulos       Módulos       Módulos
         │             │             │
      Meta ✓         Meta ✓         Meta ✓
      Dashboard ✓    Dashboard ✓    Dashboard ✓
         │             │
      Meta Ads       Meta Ads
         │             │
       Leads         Leads
         │             │
      Dashboard     Dashboard
```

**El MVP está terminado cuando:**

1. Existen empresas (`organizaciones`) aisladas por `organizacion_id`.
2. Puedes crear/editar/desactivar empresas (`estado = 0`), ver usuarios y activar módulos desde `/admin`.
3. Un usuario de empresa (creado/asignado por el admin de plataforma) puede iniciar sesión, conectar Meta, recibir leads por webhook y verlos en `/leads` y `/dashboard`.
4. `META_LEADS` y `DASHBOARD` están activos por defecto; CRM / WhatsApp / Automatizaciones existen en catálogo pero no se construyen aún.
5. **Alta de empresas solo por admin de plataforma.** No hay registro público que cree organizaciones.

---

## 2. Estado actual

**MVP (fases 0–11) + extensiones Meta (fases 12–16) implementados** en `back-saas-crm` + `front-saas-crm`. Build pasa en ambos repos.

| Área | Estado |
|------|--------|
| Backend | NestJS 11, Prisma, auth JWT, platform-admin, organizations, Meta (OAuth dinámico por features, **N páginas**, **N cuentas ads**, forms/backfill/salud webhook, **Insights diarios**, **salud permisos + opt-in**, leads, dashboard KPIs + ads KPIs/CPL), notificaciones in-app |
| Frontend | Next.js 16, login, admin, `/settings` + hub `/settings/meta` (Conexión con panel permisos), `/leads`, `/dashboard` (leads + inversión/CPL), notificaciones, TanStack Query, RHF+Zod |
| Datos | Neon PostgreSQL + migraciones + seed (`meta_paginas`, `meta_cuentas_publicitarias`, `meta_formularios`, `meta_insights_diarios`, `features_deseadas` en conexiones, …) |
| Infra local | API `:4000`, Next `:3000`, CORS, prefijo `/api`, `proxy.ts` refresh en frontend |
| Graph API | Versión única `META_GRAPH_VERSION` (default `v25.0`) |

**Pendiente operativo (no bloquea código):** smoke test E2E con Meta real en producción, rotar `SEED_ADMIN_PASSWORD` si aún aplica.

Detalle de diseño ya absorbido en este documento. Roadmap futuro: [INVESTIGACION-META-API.md](./INVESTIGACION-META-API.md).

Ver **§15 Huecos conocidos** para deuda técnica priorizada.

### Decisión de frontend — TailAdmin por copia

La plantilla en `front-saas-crm/free-nextjs-admin-dashboard-main` es un **catálogo de referencia**, no la app.

Cuando haga falta un UI (tabla, modal, input, chart, sidebar, sign-in):

1. Localizar el componente en `free-nextjs-admin-dashboard-main/src/...`
2. **Copiarlo** a nuestra estructura (`src/components/...` o al módulo que lo use)
3. Ajustar imports, tipos y dependencias a nuestro proyecto
4. Reutilizar ese componente en las pantallas; no inventar UI nueva si ya existe en la plantilla

No se ejecuta ni se despliega la carpeta de la plantilla. A largo plazo puede eliminarse cuando ya no haga falta como referencia.

### Base de datos — Neon PostgreSQL

No hay Docker Postgres local en el MVP. Prisma apunta a **Neon** (pooler, SSL obligatorio).

Credenciales **solo en** `back-saas-crm/.env` (gitignored). Nunca en el código ni en este `PLAN.md`.

Variables:

```env
PGHOST=ep-delicate-darkness-axsciins-pooler.c-4.us-east-2.aws.neon.tech
PGDATABASE=neondb
PGUSER=neondb_owner
PGPASSWORD=<secret>
PGSSLMODE=require
PGCHANNELBINDING=require

# Prisma usa esta URL (equivalente a las vars de arriba)
DATABASE_URL="postgresql://neondb_owner:<secret>@ep-delicate-darkness-axsciins-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

`.env.example` documenta los nombres de variables con placeholders; el password real vive solo en `.env`.

---

## 3. Principios (no negociables en el MVP)

1. **Todo dato de cliente lleva `organizacion_id`.** Queries, writes y listados siempre filtrados por organización del request. Sin excepciones en módulos de cliente.
2. **Multi-tenant = base compartida, aislamiento por fila.** No hay schema por empresa en el MVP.
3. **Los módulos son feature flags persistidos**, no ifs sueltos en el frontend. El backend es la fuente de verdad (`organizacion_modulos.habilitado`).
4. **Tres preguntas en cada request de cliente:**
   - ¿El usuario pertenece a esta empresa?
   - ¿La empresa tiene este módulo habilitado?
   - ¿El rol permite esta acción?
5. **El panel `/admin` es de plataforma**, no de cliente. Un admin de plataforma no se mezcla con `PROPIETARIO` / `ADMINISTRADOR` / `USUARIO` de una empresa.
6. **Tokens de Meta se cifran en reposo** (AES-256-GCM). Nunca se loguean ni se devuelven en claro al frontend.
7. **Sin Redis / BullMQ / pipeline CRM / billing** en el MVP.
8. **UI desde TailAdmin por copia.** Primero buscar en `free-nextjs-admin-dashboard-main`; copiar el componente a nuestra estructura y reutilizarlo. Solo crear UI nueva si la plantilla no lo cubre.
9. **Iconos con Iconify.** No embeber SVGs sueltos. Usar el componente reutilizable `Icon` (`name`, `size`, `color`, etc.). Los iconos de TailAdmin se sustituyen por nombres Iconify al copiar UI.
10. **BD en español + snake_case.** Tablas y columnas en español (`usuarios`, `fecha_creacion`). Toda tabla incluye auditoría y eliminación lógica (`estado`).
11. **No hard-delete de negocio.** Borrar = `estado = 0`. Los listados filtran `estado = 1` por defecto.
12. **Zona horaria Lima (Perú).** Producto y reportes en `America/Lima` (UTC−5, sin DST). Timestamps en BD en UTC; “hoy / semana / mes” y UI se interpretan en Lima.

---

## 4. Modelo de datos

### 4.0 Convenciones de BD (cerradas)

| Regla | Detalle |
|-------|---------|
| Idioma | Tablas y columnas en **español** |
| Naming | **snake_case** (`organizacion_usuarios`, `fecha_creacion`) |
| PK | `id` UUID |
| Booleanos / flags | `SMALLINT` `0` \| `1` (no boolean nativo) |
| Timestamps | `TIMESTAMPTZ` guardados en **UTC** |
| Zona horaria app | **`America/Lima`** (Perú). Default de org y de KPIs/filtros de fecha |
| JSON | `JSONB` para payloads externos (`datos_crudos`) |
| Soft delete | `estado`: **`1` = activo**, **`0` = eliminado lógico** |
| Prisma | Models en código pueden ser PascalCase; `@@map` / `@map` a nombres en español |

**Columnas de auditoría (obligatorias en TODAS las tablas):**

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `estado` | `SMALLINT NOT NULL DEFAULT 1` | `1` activo · `0` eliminado lógico |
| `usuario_creacion` | `UUID NULL` | UUID del usuario (null = sistema / seed / webhook). **Sin FK Prisma** |
| `usuario_edicion` | `UUID NULL` | UUID del usuario. **Sin FK Prisma** |
| `fecha_creacion` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Alta del registro |
| `fecha_modificacion` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Última modificación (actualizar en cada UPDATE) |

En Prisma/Nest: middleware o helper que setea `usuario_creacion` / `usuario_edicion` / `fecha_modificacion` desde el request context.

**Auditoría — decisión cerrada:** `usuario_creacion` y `usuario_edicion` son columnas UUID sueltas (sin `@relation` / FK en Prisma). Evita el ruido de 2 relaciones nombradas por tabla + auto-relación en `Usuario`. Siguen siendo el id de `usuarios`; si más adelante hace falta navegar “quién creó/editó” vía Prisma include, se agregan las relaciones.

**Zona horaria (`America/Lima`):**

| Capa | Comportamiento |
|------|----------------|
| PostgreSQL / Prisma | Persistir siempre `TIMESTAMPTZ` en UTC (`now()` del servidor/DB) |
| Backend | Convertir rangos de filtros (“hoy”, “esta semana”, “este mes”) con `America/Lima` antes de consultar |
| Frontend | Mostrar fechas/horas en Lima; inputs de fecha asumen Lima |
| `organizaciones.zona_horaria` | Default `'America/Lima'`; en MVP todas las orgs usan Lima (campo listo si luego hay multi-tz) |

---

### 4.1 Diagrama del núcleo SaaS

```
usuarios 1 ─── * organizacion_usuarios * ─── 1 organizaciones
                                                  │
                                                  │ 1
                                                  │
                                                  * organizacion_modulos * ─── 1 modulos
```

### 4.2 `usuarios`

Identidad global (un email = un usuario).

| Columna | Tipo | Notas |
|---------|------|--------|
| `id` | UUID PK | |
| `email` | VARCHAR(255) NOT NULL | UNIQUE (entre `estado = 1`) |
| `password_hash` | VARCHAR(255) NOT NULL | bcrypt |
| `nombre` | VARCHAR(120) NOT NULL | |
| `apellido` | VARCHAR(120) NULL | |
| `telefono` | VARCHAR(40) NULL | |
| `avatar_url` | TEXT NULL | |
| `es_admin_plataforma` | SMALLINT NOT NULL DEFAULT 0 | `1` = dueño del SaaS |
| `ultimo_login` | TIMESTAMPTZ NULL | |
| `estado` | SMALLINT NOT NULL DEFAULT 1 | auditoría |
| `usuario_creacion` | UUID NULL | |
| `usuario_edicion` | UUID NULL | |
| `fecha_creacion` | TIMESTAMPTZ NOT NULL | |
| `fecha_modificacion` | TIMESTAMPTZ NOT NULL | |

Índices: UNIQUE(`email`), INDEX(`es_admin_plataforma`), INDEX(`estado`).

### 4.3 `organizaciones`

Empresa cliente (tenant).

| Columna | Tipo | Notas |
|---------|------|--------|
| `id` | UUID PK | |
| `nombre` | VARCHAR(200) NOT NULL | Nombre comercial |
| `slug` | VARCHAR(120) NOT NULL | UNIQUE, URL-friendly |
| `razon_social` | VARCHAR(255) NULL | |
| `documento_fiscal` | VARCHAR(50) NULL | RUC / NIT / CIF |
| `email_contacto` | VARCHAR(255) NULL | |
| `telefono_contacto` | VARCHAR(40) NULL | |
| `logo_url` | TEXT NULL | |
| `pais` | VARCHAR(2) NULL | ISO 3166-1 alpha-2 |
| `zona_horaria` | VARCHAR(64) NOT NULL DEFAULT `'America/Lima'` | IANA. MVP: Lima, Perú |
| `notas` | TEXT NULL | Uso interno plataforma |
| `estado` | SMALLINT NOT NULL DEFAULT 1 | Desactivar empresa = `0` |
| `usuario_creacion` | UUID NULL | |
| `usuario_edicion` | UUID NULL | |
| `fecha_creacion` | TIMESTAMPTZ NOT NULL | |
| `fecha_modificacion` | TIMESTAMPTZ NOT NULL | |

Índices: UNIQUE(`slug`), INDEX(`estado`).

### 4.4 `organizacion_usuarios`

Membresía de un usuario en una empresa + rol.

| Columna | Tipo | Notas |
|---------|------|--------|
| `id` | UUID PK | |
| `organizacion_id` | UUID NOT NULL | FK → `organizaciones.id` |
| `usuario_id` | UUID NOT NULL | FK → `usuarios.id` |
| `rol` | VARCHAR(30) NOT NULL | `PROPIETARIO` \| `ADMINISTRADOR` \| `USUARIO` |
| `estado` | SMALLINT NOT NULL DEFAULT 1 | |
| `usuario_creacion` | UUID NULL | |
| `usuario_edicion` | UUID NULL | |
| `fecha_creacion` | TIMESTAMPTZ NOT NULL | |
| `fecha_modificacion` | TIMESTAMPTZ NOT NULL | |

Índices: UNIQUE(`organizacion_id`, `usuario_id`), INDEX(`usuario_id`), INDEX(`rol`), INDEX(`estado`).

### 4.5 `modulos`

Catálogo de funcionalidades del SaaS.

| Columna | Tipo | Notas |
|---------|------|--------|
| `id` | UUID PK | |
| `codigo` | VARCHAR(50) NOT NULL | UNIQUE. Ej: `META_LEADS` |
| `nombre` | VARCHAR(120) NOT NULL | |
| `descripcion` | TEXT NULL | |
| `icono` | VARCHAR(80) NULL | Nombre Iconify, ej. `mdi:view-dashboard` |
| `orden` | INT NOT NULL DEFAULT 0 | Orden en menú/admin |
| `estado` | SMALLINT NOT NULL DEFAULT 1 | `0` = módulo retirado del catálogo |
| `usuario_creacion` | UUID NULL | |
| `usuario_edicion` | UUID NULL | |
| `fecha_creacion` | TIMESTAMPTZ NOT NULL | |
| `fecha_modificacion` | TIMESTAMPTZ NOT NULL | |

**Seed inicial (`codigo`):**

| codigo | En MVP | Default al crear organización (`habilitado`) |
|--------|--------|-----------------------------------------------|
| `META_LEADS` | Sí | `1` |
| `DASHBOARD` | Sí | `1` |
| `CRM` | Solo catálogo | `0` |
| `WHATSAPP` | Solo catálogo | `0` |
| `AUTOMATIZACIONES` | Solo catálogo | `0` |

### 4.6 `organizacion_modulos`

Qué módulos tiene encendidos cada empresa.

| Columna | Tipo | Notas |
|---------|------|--------|
| `id` | UUID PK | |
| `organizacion_id` | UUID NOT NULL | FK → `organizaciones.id` |
| `modulo_id` | UUID NOT NULL | FK → `modulos.id` |
| `habilitado` | SMALLINT NOT NULL DEFAULT 0 | `1` encendido · `0` apagado |
| `fecha_activacion` | TIMESTAMPTZ NULL | Primera vez que pasó a `1` |
| `estado` | SMALLINT NOT NULL DEFAULT 1 | Soft delete del vínculo |
| `usuario_creacion` | UUID NULL | |
| `usuario_edicion` | UUID NULL | |
| `fecha_creacion` | TIMESTAMPTZ NOT NULL | |
| `fecha_modificacion` | TIMESTAMPTZ NOT NULL | |

Índices: UNIQUE(`organizacion_id`, `modulo_id`), INDEX(`habilitado`), INDEX(`estado`).

---

### 4.7 Diagrama Meta + leads (estado actual)

```
organizaciones
     │
     ├── meta_conexiones          → 1 sesión OAuth / App por org
     │      ├── meta_paginas      → N páginas Lead Ads (webhook por page_id)
     │      │      └── meta_formularios  → N leadgen forms por página
     │      └── meta_cuentas_publicitarias → N ad accounts
     │
     ├── campanas (+ meta_cuenta_publicitaria_id)
     │      └── conjuntos_anuncios
     │            └── anuncios
     │
     └── leads (+ meta_pagina_id, formulario_id Meta)
```

Todos los registros de cliente llevan `organizacion_id`.

> **MVP original (§4.8):** `page_id` / `ad_account_id` vivían en `meta_conexiones`. **Fase 13:** pasaron a tablas N; esas columnas en `meta_conexiones` quedan **legacy** (no se borran; el runtime escribe en `meta_paginas` / `meta_cuentas_publicitarias`).

### 4.8 `meta_conexiones`

OAuth / Meta App por organización (1 sesión activa por org).

| Columna | Tipo | Notas |
|---------|------|--------|
| `id` | UUID PK | |
| `organizacion_id` | UUID NOT NULL | FK → `organizaciones.id` |
| `app_id` / `app_secret_cifrado` | | Meta App propia de la org |
| `meta_user_id` | VARCHAR(64) NULL | Tras OAuth |
| `meta_user_nombre` | VARCHAR(200) NULL | |
| `token_cifrado` | TEXT NULL | User token AES-256-GCM |
| `token_expira_en` | TIMESTAMPTZ NULL | |
| `scopes` | TEXT NULL | Persistidos tras OAuth / `debug_token` (Fase 16) |
| `features_deseadas` | JSONB NULL | Opt-in de features Meta (Fase 16.4); núcleo siempre forzado server-side |
| `webhook_verify_token` | VARCHAR(128) NOT NULL | Challenge webhook |
| `page_id` / `page_nombre` / `ad_account_*` | | **Legacy MVP** — no usar en runtime nuevo |
| Auditoría | | `estado`, `usuario_*`, `fecha_*` |

### 4.8b `meta_paginas` ✅ Fase 13

| Columna | Notas |
|---------|--------|
| `page_id`, `nombre`, `token_pagina_cifrado` | Página FB + page token |
| `webhook_suscrito`, `webhook_suscrito_en` | Suscripción leadgen |
| `webhook_ultimo_check_en`, `webhook_ultimo_error` | Salud Graph (Fase 14) |
| `foto_url`, `categoria` | Opcional |
| Unique parcial | `page_id` único entre activas (global org) |

### 4.8c `meta_cuentas_publicitarias` ✅ Fase 13

| Columna | Notas |
|---------|--------|
| `ad_account_id`, `nombre`, `moneda`, `estado_cuenta`, `timezone` | |
| `ultimo_sync_en` | Sync manual campañas/ad sets/ads |
| Unique parcial | `(organizacion_id, ad_account_id)` entre activas |

### 4.8d `meta_formularios` ✅ Fase 14

| Columna | Notas |
|---------|--------|
| `meta_pagina_id`, `form_id`, `nombre`, `estado_meta` | Catálogo Graph `leadgen_forms` |
| `ultimo_sync_en` | Sync on-demand desde perfil de página |

### 4.8e `meta_insights_diarios` ✅ Fase 15

Snapshots diarios Ads Insights (nivel cuenta y/o campaña).

| Columna | Notas |
|---------|--------|
| `meta_cuenta_publicitaria_id` | FK siempre |
| `campana_id` | NULL = agregado cuenta ese día; no NULL = campaña |
| `fecha` | DATE (día del rango Graph) |
| `spend`, `impressions`, `clicks`, `ctr`, `cpc`, `reach`, `moneda` | Métricas |
| `datos_crudos` | JSONB respuesta Insights |
| Unicidad | Índices únicos **parciales** (cuenta con `campana_id IS NULL`; campaña con `campana_id IS NOT NULL`) |

### 4.9 `campanas`

| Columna | Tipo | Notas |
|---------|------|--------|
| `id` | UUID PK | |
| `organizacion_id` | UUID NOT NULL | FK |
| `meta_cuenta_publicitaria_id` | UUID NULL | FK → `meta_cuentas_publicitarias` (Fase 13) |
| `meta_campana_id` | VARCHAR(64) NOT NULL | ID en Meta |
| `nombre` | VARCHAR(255) NOT NULL | |
| `estado_meta` | VARCHAR(40) NULL | ACTIVE, PAUSED, etc. (≠ `estado`) |
| `datos_crudos` | JSONB NULL | Payload Graph API |
| `estado` | SMALLINT NOT NULL DEFAULT 1 | Soft delete local |
| `usuario_creacion` | UUID NULL | |
| `usuario_edicion` | UUID NULL | |
| `fecha_creacion` | TIMESTAMPTZ NOT NULL | |
| `fecha_modificacion` | TIMESTAMPTZ NOT NULL | |

Índices: UNIQUE(`organizacion_id`, `meta_campana_id`), INDEX(`estado`).

### 4.10 `conjuntos_anuncios`

| Columna | Tipo | Notas |
|---------|------|--------|
| `id` | UUID PK | |
| `organizacion_id` | UUID NOT NULL | FK |
| `campana_id` | UUID NOT NULL | FK → `campanas.id` |
| `meta_conjunto_id` | VARCHAR(64) NOT NULL | ID Ad Set en Meta |
| `nombre` | VARCHAR(255) NOT NULL | |
| `estado_meta` | VARCHAR(40) NULL | |
| `datos_crudos` | JSONB NULL | |
| `estado` | SMALLINT NOT NULL DEFAULT 1 | |
| `usuario_creacion` | UUID NULL | |
| `usuario_edicion` | UUID NULL | |
| `fecha_creacion` | TIMESTAMPTZ NOT NULL | |
| `fecha_modificacion` | TIMESTAMPTZ NOT NULL | |

Índices: UNIQUE(`organizacion_id`, `meta_conjunto_id`), INDEX(`campana_id`), INDEX(`estado`).

### 4.11 `anuncios`

| Columna | Tipo | Notas |
|---------|------|--------|
| `id` | UUID PK | |
| `organizacion_id` | UUID NOT NULL | FK |
| `conjunto_anuncio_id` | UUID NOT NULL | FK → `conjuntos_anuncios.id` |
| `meta_anuncio_id` | VARCHAR(64) NOT NULL | ID Ad en Meta |
| `nombre` | VARCHAR(255) NOT NULL | |
| `estado_meta` | VARCHAR(40) NULL | |
| `datos_crudos` | JSONB NULL | |
| `estado` | SMALLINT NOT NULL DEFAULT 1 | |
| `usuario_creacion` | UUID NULL | |
| `usuario_edicion` | UUID NULL | |
| `fecha_creacion` | TIMESTAMPTZ NOT NULL | |
| `fecha_modificacion` | TIMESTAMPTZ NOT NULL | |

Índices: UNIQUE(`organizacion_id`, `meta_anuncio_id`), INDEX(`conjunto_anuncio_id`), INDEX(`estado`).

### 4.12 `leads`

| Columna | Tipo | Notas |
|---------|------|--------|
| `id` | UUID PK | |
| `organizacion_id` | UUID NOT NULL | FK |
| `meta_pagina_id` | UUID NULL | FK → `meta_paginas` (Fase 13) |
| `campana_id` | UUID NULL | FK → `campanas.id` |
| `conjunto_anuncio_id` | UUID NULL | FK → `conjuntos_anuncios.id` |
| `anuncio_id` | UUID NULL | FK → `anuncios.id` |
| `formulario_id` | VARCHAR(64) NULL | Form ID Meta (catálogo en `meta_formularios`) |
| `id_externo` | VARCHAR(64) NOT NULL | Leadgen ID Meta |
| `nombre` | VARCHAR(200) NULL | |
| `email` | VARCHAR(255) NULL | |
| `telefono` | VARCHAR(40) NULL | |
| `datos_crudos` | JSONB NOT NULL | Respuesta completa Graph API |
| `fecha_lead` | TIMESTAMPTZ NULL | `created_time` de Meta |
| `estado` | SMALLINT NOT NULL DEFAULT 1 | |
| `usuario_creacion` | UUID NULL | null en ingestión webhook |
| `usuario_edicion` | UUID NULL | |
| `fecha_creacion` | TIMESTAMPTZ NOT NULL | Alta en nuestro sistema |
| `fecha_modificacion` | TIMESTAMPTZ NOT NULL | |

Índices: UNIQUE(`organizacion_id`, `id_externo`) → idempotencia webhook; INDEX(`email`), INDEX(`telefono`), INDEX(`campana_id`), INDEX(`anuncio_id`), INDEX(`fecha_lead`), INDEX(`estado`).

---

### 4.13 Auth — `tokens_refresco`

| Columna | Tipo | Notas |
|---------|------|--------|
| `id` | UUID PK | |
| `usuario_id` | UUID NOT NULL | FK → `usuarios.id` |
| `token_hash` | VARCHAR(255) NOT NULL | Nunca guardar el token en claro |
| `expira_en` | TIMESTAMPTZ NOT NULL | |
| `revocado_en` | TIMESTAMPTZ NULL | Logout / rotación |
| `ip` | VARCHAR(64) NULL | |
| `user_agent` | TEXT NULL | |
| `estado` | SMALLINT NOT NULL DEFAULT 1 | |
| `usuario_creacion` | UUID NULL | = `usuario_id` habitualmente |
| `usuario_edicion` | UUID NULL | |
| `fecha_creacion` | TIMESTAMPTZ NOT NULL | |
| `fecha_modificacion` | TIMESTAMPTZ NOT NULL | |

Índices: INDEX(`usuario_id`), INDEX(`token_hash`), INDEX(`expira_en`), INDEX(`estado`).

Access token corto (JWT) + refresh rotativo. JWT cliente: `usuario_id`, `organizacion_id`, `rol`. JWT plataforma: `usuario_id`, `es_admin_plataforma: 1`.

---

### 4.14 Resumen de tablas del MVP

| Tabla | Propósito |
|-------|-----------|
| `usuarios` | Identidad |
| `organizaciones` | Tenant / empresa |
| `organizacion_usuarios` | Membresía + rol |
| `modulos` | Catálogo de features |
| `organizacion_modulos` | Features por empresa |
| `tokens_refresco` | Sesiones refresh |
| `meta_conexiones` | OAuth Meta |
| `campanas` | Campañas Meta |
| `conjuntos_anuncios` | Ad sets |
| `anuncios` | Ads |
| `leads` | Leads capturados |

**No se agregan tablas nuevas en el MVP sin actualizar esta sección primero.**

---

## 5. Autenticación y autorización

### 5.1 Flujos

| Flujo | Comportamiento MVP |
|-------|-------------------|
| **Alta de empresa** | Solo `es_admin_plataforma = 1` desde `/admin`: crea `organizaciones` + `organizacion_modulos` (`META_LEADS` y `DASHBOARD` con `habilitado = 1`) + opcionalmente el primer usuario `PROPIETARIO` |
| **Alta de usuario** | Solo admin de plataforma (o más adelante el PROPIETARIO). Crea `usuarios` + `organizacion_usuarios` con un rol. **No** existe auto-registro público |
| **Login** | Email/password → access + refresh. Org activa = **primera membresía activa** (`estado = 1`) ordenada por `fecha_creacion`. Admin de plataforma sin org: JWT solo con `es_admin_plataforma`. Selector multi-org = endpoint futuro, no parte de este flujo |
| **Logout** | Revoca fila en `tokens_refresco` (`revocado_en` + `estado = 0`) |
| **Refresh** | Rota refresh; emite nuevo access con el mismo `organizacion_id` activo |

**No hay** `POST /auth/register` público en el MVP. Pantalla cliente: solo `/login`. Invitaciones self-serve quedan fuera de alcance.

### 5.2 Roles

**Empresa (cliente)** — columna `organizacion_usuarios.rol`:

| Rol | Puede |
|-----|--------|
| `PROPIETARIO` | Todo en su org, incluida conexión Meta y settings |
| `ADMINISTRADOR` | Operar leads/dashboard/Meta (sin borrar la org) |
| `USUARIO` | Ver leads y dashboard |

**Plataforma (tú):**

| Flag | Puede |
|------|--------|
| `usuarios.es_admin_plataforma = 1` | CRUD empresas, usuarios, módulos, `organizacion_modulos`. No opera leads de clientes como propios. |

`es_admin_plataforma` vive en `usuarios`, no en `organizacion_usuarios`.

### 5.3 Contexto de cada request

```ts
{
  usuarioId: string
  organizacionId?: string  // ausente en rutas /admin
  rol?: 'PROPIETARIO' | 'ADMINISTRADOR' | 'USUARIO'
  esAdminPlataforma: boolean
}
```

`organizacionId` sale del JWT (org activa). No se confía en un `organizacion_id` enviado en el body para autorizar.

### 5.4 Guards NestJS (orden)

1. `JwtAuthGuard` — hay sesión válida.
2. `OrgMembershipGuard` — el user pertenece a la org del token, org y membresía con `estado = 1`.
3. `RolesGuard` — `@Roles('PROPIETARIO', 'ADMINISTRADOR')`.
4. `ModuleGuard` — `@RequireModule('META_LEADS')` consulta `organizacion_modulos.habilitado = 1` y `estado = 1`.
5. `PlatformAdminGuard` — solo rutas `/admin/*` (`es_admin_plataforma = 1`).

Si el módulo está apagado → `403` (no `404` silencioso). El frontend oculta el ítem de menú según los módulos que devuelve `GET /me`.

---

## 6. Arquitectura de carpetas

### 6.1 Backend — clean architecture **dentro de cada módulo**

Prisma vive en la raíz del repo (`prisma/schema.prisma`), no dentro de `src/`.

```
back-saas-crm/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── src/
    ├── main.ts
    ├── app.module.ts
    ├── shared/                    # kernel compartido
    │   ├── domain/
    │   ├── application/           # ports (interfaces)
    │   ├── infrastructure/        # PrismaService, crypto, config
    │   └── presentation/          # filters, interceptors, decorators
    ├── auth/
    │   ├── domain/
    │   ├── application/
    │   ├── infrastructure/
    │   └── presentation/          # controllers, guards, dtos
    ├── users/
    ├── organizations/
    ├── modules/                   # catálogo modulos + organizacion_modulos
    ├── platform-admin/            # endpoints solo es_admin_plataforma
    ├── meta/
    │   ├── connections/
    │   ├── webhooks/
    │   ├── campaigns/
    │   ├── adsets/
    │   ├── ads/
    │   └── leads/                 # ingestión Graph API / webhook
    ├── leads/                     # lectura/filtros para el cliente
    └── dashboard/
```

Cada feature: **domain** (entidades/reglas) → **application** (use cases + ports) → **infrastructure** (Prisma, HTTP Meta) → **presentation** (HTTP).

`subscriptions/` queda **fuera del MVP** (carpeta no se crea hasta billing).

### 6.2 Frontend — arquitectura modular + copia desde TailAdmin

```
front-saas-crm/
├── free-nextjs-admin-dashboard-main/   # SOLO referencia — no es la app
│   └── src/
│       ├── components/                 # origen: forms, tables, charts, ui...
│       ├── layout/                     # origen: sidebar, header...
│       └── app/(full-width-pages)/(auth)/  # origen: sign-in / sign-up
│
├── app/                                # NUESTRA app (rutas)
│   ├── (auth)/
│   │   └── login/                      # sin register público
│   ├── (app)/                          # layout cliente (copiado/adaptado)
│   │   ├── dashboard/
│   │   ├── leads/
│   │   └── settings/
│   └── (admin)/                        # layout plataforma
│       ├── organizations/
│       ├── users/
│       └── modules/
│
└── src/                                # código de producto
    ├── modules/
    │   ├── auth/
    │   ├── leads/
    │   ├── dashboard/
    │   ├── settings/
    │   └── admin/
    ├── components/                     # destino de lo copiado de la plantilla
    │   ├── ui/
    │   │   └── Icon.tsx              # Iconify: name, size, color, …
    │   ├── form/
    │   ├── tables/
    │   ├── charts/
    │   └── layout/
    └── lib/                            # api client, session, guards de ruta
```

**Flujo de trabajo UI:**

| Necesitas | Buscas en la plantilla | Copias a |
|-----------|------------------------|----------|
| Input, Select, DatePicker | `.../components/form/` | `src/components/form/` |
| Tabla | `.../components/.../tables` o pages de tables | `src/components/tables/` |
| Chart línea/barra | `.../components/charts/` | `src/components/charts/` |
| Sidebar / Header | `.../layout/` | `src/components/layout/` |
| Login | `.../components/auth/` + pages auth | Solo **Sign In** → `src/modules/auth/` + `app/(auth)/login` |
| Iconos SVG de la plantilla | `.../icons/*.svg` | **No copiar.** Reemplazar por `<Icon name="prefix:icon" />` (Iconify) |

### Iconos — Iconify

Paquete: `@iconify/react`. Componente propio: `src/components/ui/Icon.tsx`.

```tsx
import { Icon } from '@/src/components/ui/Icon'

<Icon name="mdi:home" size={20} color="currentColor" />
<Icon name="mdi:account-group" size={24} className="text-brand-500" />
```

| Prop | Tipo | Descripción |
|------|------|-------------|
| `name` | `string` | Obligatorio. Ej. `mdi:view-dashboard`, `solar:chart-bold` |
| `size` | `number \| string` | Atajo para width/height (default `20`) |
| `width` / `height` | `number \| string` | Sobrescriben `size` si se pasan |
| `color` | `string` | Color CSS; por defecto hereda (`currentColor`) |
| `className` | `string` | Clases Tailwind |
| `rotate` / `hFlip` / `vFlip` | — | Transformaciones Iconify |

**Regla:** al adaptar TailAdmin, no importar SVGs de `icons/`; mapear a un nombre Iconify equivalente. `modulos.icono` guarda ese mismo string.


El menú del cliente se construye con los módulos activos de `GET /me` (`META_LEADS` → Leads, `DASHBOARD` → Dashboard).

---

## 7. APIs del MVP (contrato mínimo)

Prefijo: `/api`. Auth: `Bearer` access token.

### Auth y sesión

| Método | Ruta | Notas |
|--------|------|--------|
| POST | `/auth/login` | Público |
| POST | `/auth/refresh` | Cookie o body con refresh |
| POST | `/auth/logout` | Revoca refresh |
| GET | `/me` | user + org activa + role + modules[] |
| PATCH | `/me` | Perfil propio: `nombre`, `apellido`, `telefono` |
| PATCH | `/me/password` | Cambio de contraseña (`passwordActual`, `passwordNueva`) |

> No hay `/auth/register` público. Altas de org/usuario solo vía `/admin/*`.

### Cliente (org + módulo)

| Método | Ruta | Módulo | Roles |
|--------|------|--------|-------|
| GET/PATCH | `/organizations/current` | — | PROPIETARIO, ADMINISTRADOR |
| GET/POST | `/meta/connections` | `META_LEADS` | PROPIETARIO, ADMINISTRADOR |
| GET | `/meta/oauth/url` | `META_LEADS` | PROPIETARIO, ADMINISTRADOR |
| GET | `/meta/oauth/callback` | `META_LEADS` | — (OAuth) |
| POST | `/meta/connections/:id/ad-account` | `META_LEADS` | PROPIETARIO, ADMINISTRADOR |
| GET | `/leads` | `META_LEADS` | PROPIETARIO, ADMINISTRADOR, USUARIO |
| GET | `/leads/:id` | `META_LEADS` | PROPIETARIO, ADMINISTRADOR, USUARIO |
| GET | `/dashboard/kpis` | `DASHBOARD` | PROPIETARIO, ADMINISTRADOR, USUARIO |
| GET | `/dashboard/series` | `DASHBOARD` | PROPIETARIO, ADMINISTRADOR, USUARIO |
| GET | `/dashboard/ads-kpis` | `DASHBOARD` | PROPIETARIO, ADMINISTRADOR, USUARIO |
| GET | `/dashboard/ads-series` | `DASHBOARD` | PROPIETARIO, ADMINISTRADOR, USUARIO |
| POST | `/meta/ad-accounts/:id/insights/sync` | `META_LEADS` | PROPIETARIO, ADMINISTRADOR |

PATCH `/organizations/current` solo: `nombre`, `razonSocial`, `documentoFiscal`, `emailContacto`, `telefonoContacto`, `logoUrl`, `pais`, `zonaHoraria`. No `slug` / `notas` / `estado`.

Webhook Meta: `GET/POST /meta/webhooks` — **público**, validado por signature / verify token. No usa JWT.

### Plataforma (`es_admin_plataforma = 1`)

| Recurso | Acciones |
|---------|----------|
| `/admin/organizations` | Crear, listar, ver, editar, **desactivar** (sin reactivar en MVP) |
| `/admin/users` | Listar, ver, **activar/desactivar**, asignar a org |
| `/admin/modules` | Crear, editar, activar/desactivar en catálogo |
| `/admin/organizations/:id/modules` | Ver y toggle por empresa |

---

## 8. Integración Meta (orden interno)

Estado actual del producto (MVP + fases 13–15):

```
Credenciales App por org → OAuth → Vincular N páginas + N cuentas ads
        ↓
Webhook leadgen → meta_paginas.page_id → org + meta_pagina_id → upsert lead
        ↓
Opcional: sync formularios / backfill / health-check webhook
        ↓
Opcional: sync Insights (spend…) → meta_insights_diarios → dashboard CPL
```

### 8.1 OAuth

1. Backend genera URL OAuth (`META_GRAPH_VERSION`, scopes Lead Ads + `ads_read`).
2. Callback intercambia `code` por token de larga duración.
3. Token de usuario se **cifra** en `meta_conexiones.token_cifrado`.
4. Frontend hub `/settings/meta`: vincular **varias** páginas y **varias** cuentas (no reemplazo único).
5. Al vincular página: page token + suscripción webhook `leadgen`.
6. Sync manual de jerarquía ads por cuenta vinculada.

### 8.2 Webhook (sin colas)

**URL pública:**

```
https://{dominio}/api/meta/webhooks?token={META_WEBHOOK_URL_TOKEN}
```

| Pieza | Rol |
|-------|-----|
| Path `/api/meta/webhooks` | `GET` verify + `POST` eventos |
| Query `token` | Candado `META_WEBHOOK_URL_TOKEN` |
| `hub.verify_token` | Por org (`webhook_verify_token`) + fallback env |
| `X-Hub-Signature-256` | HMAC con `app_secret_cifrado` de la org (lookup por `page_id`) |

Flujo:

1. `GET` — validar tokens → devolver `hub.challenge`.
2. `POST` — validar firma. Leadgen: `page_id` → **`meta_paginas`** → org.
3. Fetch Graph `/{leadgen_id}` → upsert campaña / ad set / ad → upsert lead (`meta_pagina_id`, `formulario_id`).
4. Idempotencia: UNIQUE(`organizacion_id`, `id_externo`).
5. 200 rápido; Graph falla → 5xx para reintento Meta.

### 8.3 Enrutado del webhook → organización

```
Meta webhook (page_id + leadgen_id)
        ↓
Validar ?token= + firma (App Secret de la org)
        ↓
Buscar meta_paginas WHERE page_id = ? AND estado = 1
        ↓
organizacion_id + meta_pagina_id
        ↓
Guardar lead en esa empresa
```

**Regla:** `page_id` único entre páginas activas (índice parcial). Una página no puede pertenecer a dos empresas.

### 8.4 Formularios, backfill y salud webhook ✅ Fase 14

| Capacidad | Dónde |
|-----------|--------|
| Sync catálogo `leadgen_forms` | Perfil página → “Sincronizar formularios” → `meta_formularios` |
| Filtro leads por nombre de form | `/leads` select searchable (`GET /meta/forms`) |
| Backfill / reimport por form + fechas | Perfil página → “Reimportar leads” (idempotente, cursor) |
| Health-check `subscribed_apps` | “Verificar en Meta” + badge; notificación `META_WEBHOOK_SALUD` si falla |
| Re-suscribir webhook | Ya desde Fase 13 |

No hay ruta `/settings/meta/forms` dedicada: los forms viven en el **perfil de cada página**.

### 8.5 Despliegue HTTPS (OAuth / webhook)

| Uso | URL |
|-----|-----|
| Webhook | `https://{dominio}/api/meta/webhooks?token=...` |
| OAuth callback | `https://{dominio}/api/meta/oauth/callback` |

```env
META_GRAPH_VERSION=v25.0
META_VERIFY_TOKEN=
META_WEBHOOK_URL_TOKEN=
META_OAUTH_REDIRECT_URI=https://{dominio}/api/meta/oauth/callback
FRONTEND_URL=https://{dominio-app}
```

(`META_APP_ID` / `META_APP_SECRET` globales son fallback legacy; cada org registra su App.)

---

## 9. Pantallas

### Cliente

| Ruta | Contenido |
|------|-----------|
| `/login` | Auth (sin registro público) |
| `/profile` | Perfil del usuario logueado (datos + cambio de contraseña) |
| `/leads` | Listado, búsqueda, filtros (fecha, campaña, anuncio, **página**, **cuenta ads**, formulario por nombre), detalle |
| `/dashboard` | KPIs leads + **inversión/CTR/CPC/CPL** + charts (leads e inversión); filtros fecha, campaña, ad set, anuncio, **cuenta ads** |
| `/settings` | Datos de org + card resumen Meta → hub |
| `/settings/meta` | Hub: Conexión \| Páginas \| Cuentas publicitarias |
| `/settings/meta/pages` · `/pages/[id]` | Listado + **perfil** (webhook, formularios, backfill, health) |
| `/settings/meta/ad-accounts` · `/ad-accounts/[id]` | Listado + **perfil** (sync campañas + **sync métricas Insights**) |
| `/notifications` | Notificaciones in-app (incl. alertas salud Meta) |

Sin pipeline, tareas ni oportunidades.

### Plataforma

| Ruta | Contenido |
|------|-----------|
| `/admin/organizations` | CRUD + desactivar |
| `/admin/users` | Ver + gestionar (activar, asignar org/rol) |
| `/admin/modules` | CRUD catálogo + toggle |
| `/admin/organizations/[id]` | Módulos por empresa (matriz Empresa × Módulo) |

---

## 10. Fases de implementación

Trabajar **una fase a la vez**. No abrir Meta hasta que auth + módulos + admin cierren.

### Fase 0 — Cimientos ✅

**Backend:** ConfigModule, CORS, prefijo `/api`, puerto `4000`, `.env` con Neon (`DATABASE_URL`), Prisma, `PrismaService` en `shared/infrastructure`. Sin Docker Postgres.  
**Frontend:** app router de producto; estructura modular; **Iconify** + componente `Icon` reutilizable (sin SVGs sueltos).

**Done cuando:** `npm run build` pasa en ambos repos y Prisma conecta a Neon (`prisma db pull` o migrate de prueba).

### Fase 1 — Modelo SaaS / multi-tenant ✅

Schema + migrate + seed según §4: `usuarios`, `organizaciones`, `organizacion_usuarios`, `modulos`, `organizacion_modulos` (+ auditoría en todas).

**Seed:**

| Qué | Valor |
|-----|--------|
| Admin plataforma | email `sistemas@proyectosgvr.com`, `es_admin_plataforma = 1` |
| Password | `SEED_ADMIN_PASSWORD` en `.env` (temporal fuerte; **rotar al tener login en Fase 2**) |
| Módulos | `META_LEADS`, `DASHBOARD`, `CRM`, `WHATSAPP`, `AUTOMATIZACIONES` |

No crea organizaciones de cliente: las altas van por `/admin`.

**Done cuando:** el seed deja logueable a `sistemas@proyectosgvr.com` y los 5 módulos en catálogo.

### Fase 2 — Auth ✅

Login, logout, refresh. JWT con `usuario_id` + `organizacion_id` + `rol` (si aplica). Guards base. `GET /me`. Tabla `tokens_refresco`. Sin registro público.

**Decisiones cerradas en implementación:**

| Tema | Decisión |
|------|----------|
| JWT secrets | `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` en `.env` (valores aleatorios fuertes; no commit) |
| Multi-org en login | Sin endpoint de “elegir org”. Se activa la **primera** `organizacion_usuarios` activa por `fecha_creacion`. Selector real = endpoint nuevo después |
| Password | bcrypt; nunca en claro |

**Done cuando:** Postman/HTTP: login (usuario seedeado) → `/me` → refresh → logout. Password nunca se persiste en claro.

### Fase 3 — Organizaciones (cliente) ✅

`GET/PATCH /organizations/current`. Regla: un user solo ve su org. Org desactivada → 403.

**PATCH — campos editables (cliente):**

| Permitido | Excluido (motivo) |
|-----------|-------------------|
| `nombre`, `razonSocial`, `documentoFiscal`, `emailContacto`, `telefonoContacto`, `logoUrl`, `pais`, `zonaHoraria` | `slug` — identidad estable |
| | `notas` — uso interno plataforma (§4.3); solo `/admin` |
| | `estado` — alta/baja solo `/admin` (Fase 5) |

**Done cuando:** un user de la org A no puede leer ni mutar la org B (prueba manual o e2e).

### Fase 4 — Sistema de módulos ✅

CRUD interno de catálogo (usado luego por admin). `ModuleGuard`. `GET /me` incluye `modulos: [{ codigo, habilitado }]`.

**Done cuando:** apagar `DASHBOARD` en DB (`habilitado = 0`) → `GET /dashboard/kpis` (aunque el endpoint aún stubee) responde 403.

### Fase 5 — Panel admin SaaS ✅

Backend `platform-admin` + pantallas `/admin/*`. Empresas, usuarios, módulos, matriz org × módulo.

**Decisión cerrada (alineada a §7):**

| Recurso | Ciclo de vida |
|---------|----------------|
| `/admin/organizations` | Solo **desactivar** (`estado = 0`). Sin endpoint “activar” en MVP |
| `/admin/users` | Toggle completo **activar / desactivar** |

**Done cuando:** desde UI (o API) puedes crear Empresa B, activarle solo `META_LEADS`, y un user de B no ve Dashboard.

### Fase 6 — Auth UI cliente ✅

Login, sesión (cookie httpOnly + refresh), layout protegido, menú según módulos. Sin `/register`.

**UI TailAdmin (ajuste post-fase):** login a dos columnas, sidebar/header con logos, **selector de tema claro/oscuro** (`ThemeProvider` + `ThemeToggleButton` / `ThemeTogglerTwo` vía Iconify). Datos y mutaciones con **TanStack Query**. Formularios con **React Hook Form + Zod**. Email recordado del login con **Zustand**. Feedback con **Sonner** y **spinner overlay** en cada acción (`ActionLoader` + loading en botones). Inputs reutilizables copiados del template (`Input`, `Select`, `Checkbox`, `Switch`, `TextArea`, `PasswordInput`, etc.). Sin Google/X/signup (no hay registro público).

**Done cuando:** el flujo login (usuario creado por admin) → dashboard vacío funciona en el navegador.

### Fase 6b — Pantallas de operación (antes de Meta) ✅

La Fase 5 dejó el **API** de plataforma; la Fase 6 dejó login + shell. Faltaba la UI para operar el SaaS.

**Cliente**

| Ruta | Quién | Contenido |
|------|-------|-----------|
| `/profile` | Cualquier usuario logueado | Editar `nombre`, `apellido`, `telefono`. Email de solo lectura. Cambiar contraseña |
| `/settings` | PROPIETARIO, ADMINISTRADOR | Formulario de org + conexión Meta (credenciales por org, OAuth, página, cuenta ads) |

**Plataforma** (`es_admin_plataforma = 1`)

| Ruta | Contenido |
|------|-----------|
| `/admin/organizations` | Listar, crear, ver/editar, desactivar |
| `/admin/organizations/[id]` | Detalle + matriz de módulos |
| `/admin/users` | Listar, crear (cliente o admin), ver, activar/desactivar, asignar org+rol |
| `/admin/modules` | Catálogo: crear, editar, activar/desactivar |
| `/admin/profile` | Mismo perfil que el cliente |

Login de admin de plataforma redirige a `/admin/organizations`. Un cliente que entre a `/admin/*` → `/dashboard`.

**Done cuando:** desde UI puedes crear Empresa B + su usuario, asignar módulos, editar tu perfil y la org.

Feedback UX (complemento): **TanStack Query** para lecturas/mutaciones, **React Hook Form + Zod** para validar, **Zustand** para recordar email de login, toasts con **Sonner**, spinner overlay (`ActionLoader`) y loading en cada botón.

### Fase 7 — OAuth Meta + conexión ✅

`meta/connections`: credenciales **por org** (`app_id` + `app_secret_cifrado` vía `POST /meta/connections/app-credentials`), URL OAuth, callback, cifrado de token, selección de **página** (`page_id`) + cuenta publicitaria, desconexión (limpia sesión OAuth, conserva credenciales de app). Requiere URL HTTPS alcanzable (túnel o deploy).

**Done cuando:** una org de desarrollo queda con `meta_conexiones` activa (`estado = 1`, `page_id` y `ad_account_id` llenos) y `token_cifrado` no es legible en Prisma Studio.

### Fase 8 — Modelo Meta (tablas + lectura) ✅

Schema `campanas`, `conjuntos_anuncios`, `anuncios` (con auditoría). Endpoints de lectura mínimos (para filtros). Poblado inicial **desde el webhook / lead**, no un sync masivo.

**Done cuando:** las FKs existen y un lead puede colgarse de campaña / conjunto / anuncio.

### Fase 9 — Webhook de leads ✅

Verify + firma + fetch Graph + resolver org por `page_id` → upsert `leads`. Sin Redis. Misma URL HTTPS pública que OAuth.

**Done cuando:** un lead de prueba (o del test tool de Meta) aparece en Neon con `datos_crudos`, `id_externo` y `organizacion_id` correcto.

> **Nota post-implementación:** webhook multi-org — HMAC con `app_secret_cifrado` por org y verify token por `webhook_verify_token` en DB (§15 P0 ✅).

### Fase 10 — Pantalla `/leads` ✅

Listado, búsqueda, filtros, detalle. API paginada.

**Done cuando:** un `USUARIO` de la org ve solo sus leads; org B no aparece.

### Fase 11 — Dashboard KPI ✅

KPIs + 3 gráficos + filtros. Charts en `src/components/charts/` (ApexCharts, copiados de TailAdmin). Rangos “hoy/semana/mes” y buckets diarios calculados en `America/Lima`.

**Done cuando:** los números coinciden con el listado de leads para el mismo rango/filtro (misma zona Lima).

### Fase 12 — Notificaciones in-app ✅

Notificaciones por org + WebSocket; campana en header; listado `/notifications`. Tipos usados por Meta: p. ej. `META_WEBHOOK_SALUD` (Fase 14).

**Done cuando:** el usuario ve avisos en tiempo casi real sin push browser.

### Fase 13 — Meta multi-origen ✅

- Tablas `meta_paginas`, `meta_cuentas_publicitarias`; FKs en `leads` / `campanas`.
- Webhook enruta por `meta_paginas`; N páginas y N cuentas por org.
- Hub UI `/settings/meta` + perfiles; filtros `metaPaginaId` / `metaCuentaId` en leads y dashboard.

**Done cuando:** org con ≥2 páginas/cuentas; perfiles navegables; webhook por `page_id` único.

### Fase 14 — Consolidar Lead Ads ✅

- `META_GRAPH_VERSION` unificado.
- Catálogo `meta_formularios` + sync Graph en perfil de página.
- Filtro leads por nombre de formulario.
- Backfill/reimport idempotente por form + fechas.
- Health-check webhook + notificación in-app (on-demand, sin cron).

**Done cuando:** sync forms + backfill + health verificados en código (smoke Meta real = operativo §13).

### Fase 15 — Marketing API Insights + CPL ✅

Oleada B del catálogo Meta: métricas publicitarias + reporting híbrido.

- Tabla `meta_insights_diarios` (snapshots diarios cuenta/campaña) + sync on-demand Graph `/{act}/insights` (`time_increment=1`, rango ≤31 días).
- `POST /meta/ad-accounts/:id/insights/sync` + UI “Sincronizar métricas” en perfil de cuenta.
- `GET /dashboard/ads-kpis` y `/dashboard/ads-series`: spend, impressions, clicks, CTR, CPC, **CPL** (= spend Meta ÷ leads CRM del mismo filtro; `null` si 0 leads).
- Dashboard: cards inversión/CTR/CPC/CPL + chart “Inversión por día”; filtros existentes respetados.
- Sin async jobs / Redis; sin breakdowns demográficos; sin ROAS/CAPI/audiencias.
- Verificación con datos QA en BD (cifras coherentes); smoke Graph real = operativo §13.

**Done cuando:** sync Insights persiste diarios; dashboard muestra spend + CPL alineados al filtro (cuenta/fechas/campaña).

**CPL (definición cerrada):** `spend_periodo / leads_periodo` — misma ventana y filtros que el dashboard de leads; sin sumar cross-currency en v1.

### Fase 16 — Salud de permisos Meta + opt-in ✅

Panel en hub Conexión: qué scopes tiene el token vs qué necesita cada feature; activar/desactivar opt-in.

- `GET /debug_token` → scopes live; persistidos en `meta_conexiones.scopes` tras OAuth.
- Matriz de features (núcleo Lead Ads + opt-ins Pages/Ads/IG/Business) en código.
- `GET /meta/connections/permissions` + UI `MetaPermissionsPanel` (OK/Falta, badge faltantes deseados).
- Columna `features_deseadas` JSONB; OAuth `scope=` dinámico según deseadas (o una feature al “Otorgar en Meta”).
- Toggle opt-in: soft off + opción `revocarEnMeta` (`DELETE /{user}/permissions/{scope}`).
- Features núcleo (`pages_show_list`, `pages_manage_metadata`, `leads_retrieval`) no desactivables.
- Nota UI: Advanced Access / App Review no se detecta por API.
- Sin granular `target_ids` (diferido).

**Done cuando:** org ve permisos reales; puede opt-in BM/Insights (etc.) pidiendo solo esos scopes; soft/hard off funciona.

---

## 11. Fuera de alcance (siguiente)

Aún **no** implementado (ver [INVESTIGACION-META-API.md](./INVESTIGACION-META-API.md)):

- CAPI Conversion Leads / custom audiences (Oleada C)
- WhatsApp / Messenger inbox (Oleada D)
- Ads manager / Ad Rules (crear/pausar campañas) (Oleada E) — scope `ads_management` puede pre-autorizarse en Fase 16; feature producto pendiente
- Breakdowns Insights (edad/género/placement) / async Insights + cron
- Granular scopes (`target_ids`) en panel permisos
- ROAS (requiere conversiones Pixel/CAPI)
- Catalog / Commerce / publicación orgánica (scopes opt-in pueden pre-autorizarse; producto pendiente)
- Invitaciones self-serve / registro público
- Selector multi-organización
- Billing / `subscriptions/`
- Redis, BullMQ, workers
- Pipeline, tareas, oportunidades
- App móvil

**Roadmap / catálogo API:** [INVESTIGACION-META-API.md](./INVESTIGACION-META-API.md).


Cuando se agregue un módulo nuevo: fila en `modulos` + `organizacion_modulos` + carpeta Nest + menú. **No se toca el kernel.**

---

## 12. Decisiones técnicas cerradas para el MVP

| Tema | Decisión |
|------|----------|
| Alta de empresas | **Solo admin de plataforma** (`/admin`). Sin registro público que cree orgs |
| Alta de usuarios | Solo admin de plataforma en el MVP (asigna org + rol) |
| Auth pública | Solo `login` / `refresh` / `logout` |
| Webhook → org | Lookup **`meta_paginas.page_id`** → `organizacion_id` (+ `meta_pagina_id` en el lead) |
| Webhook URL | `https://{dominio}/api/meta/webhooks?token=...` (+ verify + firma por org) |
| Graph API | `META_GRAPH_VERSION` (default `v25.0`) — OAuth + client únicos |
| Páginas / cuentas Meta | N por org (`meta_paginas`, `meta_cuentas_publicitarias`) |
| Formularios leadgen | Catálogo `meta_formularios` + sync/backfill en perfil de página |
| Insights / CPL | Snapshots diarios `meta_insights_diarios`; sync on-demand; CPL = spend Meta ÷ leads CRM |
| Permisos Meta | `debug_token` + matriz features; OAuth dinámico; opt-in con soft/hard off (`features_deseadas`) |
| Deploy HTTPS | No bloquea fases 0–6; obligatorio para Meta. Dominio se define después |
| Tenancy | Shared DB + `organizacion_id` |
| Base de datos | Neon PostgreSQL (pooler + SSL). Credenciales en `.env` |
| Naming BD | Español + snake_case; Prisma `@@map` / `@map` |
| Auditoría | `estado`, `usuario_creacion`, `usuario_edicion`, `fecha_creacion`, `fecha_modificacion` en todas las tablas |
| Auditoría FK | `usuario_creacion` / `usuario_edicion` = UUID sin relación Prisma (sin include). Se puede añadir FK después |
| Soft delete | `estado`: `1` activo · `0` eliminado |
| Zona horaria | `America/Lima` (persistencia UTC; UI y KPIs en hora Perú) |
| Flags | SMALLINT `0`/`1` (`habilitado`, `es_admin_plataforma`) |
| IDs | UUID |
| Auth | JWT access corto + `tokens_refresco` (hash) · secrets en `.env` |
| Password hash | bcrypt |
| Org activa | Claim `organizacion_id` en el JWT |
| Multi-org login | Primera membresía activa por `fecha_creacion` (sin selector aún) |
| PATCH org cliente | Solo perfil comercial (nombre, contacto, logo, país, zona…). No `slug` / `notas` / `estado` |
| Admin org ciclo de vida | Solo desactivar (sin activar en MVP) |
| Admin user ciclo de vida | Toggle activar / desactivar |
| Admin plataforma | `usuarios.es_admin_plataforma = 1` |
| Seed admin | email `sistemas@proyectosgvr.com` · password en `SEED_ADMIN_PASSWORD` (rotar tras Fase 2) |
| Roles empresa | `PROPIETARIO` \| `ADMINISTRADOR` \| `USUARIO` |
| Meta tokens | AES-256-GCM → `meta_conexiones.token_cifrado` |
| Webhooks | Síncronos, idempotentes por (`organizacion_id`, `id_externo`) |
| Puerto API | `4000` (Next en `3000`) |
| UI | Copiar componentes de `free-nextjs-admin-dashboard-main` a `src/components` / módulos |
| Iconos | Iconify (`@iconify/react`) vía componente `Icon` (`name`, `size`, `color`). Sin SVGs sueltos |

---

## 13. Checklist de cierre

### MVP (fases 0–11)

- [x] Neon + Prisma migrado y seedeado (tablas §4 + auditoría)
- [x] Login / logout / refresh (sin register público)
- [x] Admin crea empresas y usuarios
- [x] Request context: `usuarioId`, `organizacionId`, `rol`
- [x] Aislamiento: org A no ve datos de org B
- [x] Soft delete: listados admin con `estado = 1` (leads/dashboard sí filtran)
- [x] Módulos `META_LEADS` y `DASHBOARD` activos por defecto
- [x] Guards de membresía, rol y módulo
- [x] `/admin` gestiona empresas, usuarios, módulos y módulos-por-empresa
- [x] UI perfil, settings org y panel `/admin` (Fase 6b)
- [x] OAuth Meta + credenciales por org + `token_cifrado`
- [x] Webhook firma HMAC multi-org y guarda `leads` con origen
- [x] `/leads` con listado, búsqueda, filtros y detalle
- [x] `/dashboard` con 4 KPIs y 3 gráficos + filtros
- [x] Guards de ruta por módulo; `/settings` bloqueado para `USUARIO`
- [x] Redirect post-login según módulos habilitados
- [x] `npm run build` en backend y frontend

### Extensiones Meta (fases 12–16)

- [x] Notificaciones in-app + WebSocket
- [x] N páginas + N cuentas ads; hub `/settings/meta` + perfiles
- [x] Webhook enruta por `meta_paginas`; `page_id` único parcial
- [x] Filtros leads/dashboard por página y cuenta ads
- [x] `META_GRAPH_VERSION` unificado
- [x] Catálogo forms + sync + filtro leads por nombre
- [x] Backfill/reimport idempotente por form
- [x] Health-check webhook + alerta `META_WEBHOOK_SALUD`
- [x] Insights diarios + sync on-demand por cuenta ads
- [x] Dashboard ads KPIs (spend/CTR/CPC) + **CPL híbrido** + serie inversión
- [x] Salud permisos (`debug_token`) + panel en Conexión
- [x] Opt-in features + OAuth dinámico + soft/hard off

### Operativo pendiente

- [ ] Rotar `SEED_ADMIN_PASSWORD` (si aún es el seed)
- [ ] Smoke test Meta E2E en prod (OAuth → webhook → lead → sync forms / backfill / health / Insights / **permisos opt-in**)

---

## 14. Cómo usar este plan

1. Las fases **0–16** están **cerradas en código**; este `PLAN.md` es la fuente de verdad.
2. No mezclar oleadas futuras ([INVESTIGACION-META-API.md](./INVESTIGACION-META-API.md)) con deuda operativa §13 sin ticket explícito.
3. Cada cambio termina con `npm run build` en el repo tocado.
4. Meta en producción: smoke test E2E (webhook + forms + health + Insights + permisos).

**Siguiente paso concreto:** smoke Meta real en prod · o Oleada C (CAPI / audiencias) según [INVESTIGACION-META-API.md](./INVESTIGACION-META-API.md).

---

## 15. Huecos conocidos (auditoría post-MVP)

Auditoría cruzada backend + frontend (fases 0–16). Deuda **cerrada en código** salvo ítems operativos.

### P0 — Meta / webhook (backend) ✅

| # | Hueco | Estado |
|---|--------|--------|
| 1 | Webhook HMAC con `app_secret_cifrado` por org (lookup por `page_id`) | ✅ `VerificarWebhookMetaUseCase` |
| 2 | Verify token GET con `webhook_verify_token` por org (+ fallback `META_VERIFY_TOKEN`) | ✅ mismo use case |
| 3 | Smoke test E2E con Meta real (HTTPS) | ⏳ operativo — pendiente |

### P1 — Correctness / PLAN ✅

| # | Hueco | Estado |
|---|--------|--------|
| 4 | Admin `listar()` filtra `estado = 1` | ✅ repos admin + catálogo módulos |
| 5 | Suscripción automática webhook de página tras seleccionar `page_id` | ✅ `suscribirPaginaLeadgen` |
| 6 | Índice parcial único `page_id WHERE estado = 1` | ✅ migración SQL |
| 7 | Lead duplicado actualiza en lugar de ignorar | ✅ `prisma-leads.repository.ts` |
| 8 | `page_id` desconocido → log ERROR explícito (`PageSinConexionError`) | ✅ controller + use case |
| 9 | Filtro **formulario** en `/leads` | ✅ frontend |
| 10 | Redirect post-login según módulos | ✅ frontend |
| 11 | Guards de ruta en `/dashboard` y `/leads` | ✅ frontend |
| 12 | `/settings` bloqueado para rol `USUARIO` | ✅ frontend |

### P2 — Calidad / ops

| # | Hueco | Estado |
|---|--------|--------|
| 13 | Nombres campaña/anuncio en ingest vía Graph | ✅ `obtenerNombreRecurso` |
| 14 | Disconnect no pone `meta_conexiones.estado = 0` | ✅ **aceptado** — conserva credenciales App |
| 15 | Tests e2e obsoletos | ✅ placeholder documentado |
| 16 | Buscador del header sin funcionalidad | ✅ removido |
| 17 | Checkbox login “Recordar email” | ✅ frontend |
| 18 | Empty states en tablas admin | ✅ frontend |
| 19 | `app/error.tsx` / `loading.tsx` a nivel shell | ✅ frontend `(app)/` |
| 20 | `cookie-parser` en deps sin usar | ⏳ bajo impacto — refresh por body |

### Desviaciones aceptadas (documentadas)

- **Meta App por org** (no env global): producto decidió `POST /meta/connections/app-credentials`; `META_APP_SECRET` / `META_VERIFY_TOKEN` quedan como fallback legacy opcional.
- **Disconnect** limpia OAuth pero mantiene fila activa con credenciales App (`estado = 1`).
- **Rutas Meta** hub `/settings/meta/*` (Fase 13); forms en perfil de página (Fase 14), no ruta `/forms` dedicada.
- **Seed** crea org de prueba además del admin (útil en dev).
- **Health webhook** on-demand (sin cron Nest); decisión Fase 14 por hosting serverless.
- **Insights** on-demand (sin cron/async jobs); CPL es híbrido CRM (spend Meta ÷ leads locales), no réplica 1:1 de Ads Manager.
- **Permisos Meta** opt-in: núcleo Lead Ads siempre; BM/Ads/IG/etc. vía Switch + OAuth parcial; Advanced Access no detectable por API.
