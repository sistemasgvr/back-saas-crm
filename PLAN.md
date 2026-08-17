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

## 2. Estado actual (punto de partida)

| Área | Hoy | Falta |
|------|-----|--------|
| Backend | NestJS 11 vacío (`AppController` / `AppService`) | Prisma, auth, módulos, Meta |
| Frontend | Next.js 16 starter + plantilla TailAdmin en `free-nextjs-admin-dashboard-main/` | App real; copiar componentes a nuestra estructura |
| Datos | Neon PostgreSQL disponible | Prisma + schema multi-tenant |
| Infra | Puerto 3000 por defecto (conflicto con Next) | Config, CORS, prefijo `/api`, `.env` |

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

### 4.7 Diagrama Meta + leads

```
organizaciones
     │
     ├── meta_conexiones
     │
     ├── campanas
     │      └── conjuntos_anuncios
     │            └── anuncios
     │
     └── leads
```

Todos los registros de cliente llevan `organizacion_id`.

### 4.8 `meta_conexiones`

OAuth / cuenta publicitaria por organización.

| Columna | Tipo | Notas |
|---------|------|--------|
| `id` | UUID PK | |
| `organizacion_id` | UUID NOT NULL | FK → `organizaciones.id` |
| `meta_user_id` | VARCHAR(64) NOT NULL | ID usuario Meta |
| `meta_user_nombre` | VARCHAR(200) NULL | |
| `ad_account_id` | VARCHAR(64) NULL | Se completa al elegir cuenta |
| `ad_account_nombre` | VARCHAR(200) NULL | |
| `page_id` | VARCHAR(64) NULL | Página Lead Ads; clave para enrutar webhook → org |
| `page_nombre` | VARCHAR(200) NULL | |
| `token_cifrado` | TEXT NOT NULL | AES-256-GCM |
| `token_expira_en` | TIMESTAMPTZ NULL | |
| `scopes` | TEXT NULL | Scopes concedidos |
| `webhook_verify_token` | VARCHAR(128) NOT NULL | Challenge webhook |
| `estado` | SMALLINT NOT NULL DEFAULT 1 | |
| `usuario_creacion` | UUID NULL | |
| `usuario_edicion` | UUID NULL | |
| `fecha_creacion` | TIMESTAMPTZ NOT NULL | |
| `fecha_modificacion` | TIMESTAMPTZ NOT NULL | |

Índices: INDEX(`organizacion_id`), UNIQUE(`page_id`) donde no null / activo, INDEX(`ad_account_id`), INDEX(`estado`). Una org = 1 conexión activa en el MVP (`estado = 1`).

### 4.9 `campanas`

| Columna | Tipo | Notas |
|---------|------|--------|
| `id` | UUID PK | |
| `organizacion_id` | UUID NOT NULL | FK |
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
| `campana_id` | UUID NULL | FK → `campanas.id` |
| `conjunto_anuncio_id` | UUID NULL | FK → `conjuntos_anuncios.id` |
| `anuncio_id` | UUID NULL | FK → `anuncios.id` |
| `formulario_id` | VARCHAR(64) NULL | Form ID Meta |
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

No se pide la Marketing API completa el primer día. Flujo de producto:

```
Conectar Meta → Autorizar permisos → Elegir cuenta publicitaria → Guardar conexión
        ↓
Webhook de leads → Validar → Fetch lead → Upsert Campaign/AdSet/Ad → Guardar Lead
```

### 8.1 OAuth

1. Backend genera URL OAuth (App ID, redirect, scopes de Lead Ads + ads_read).
2. Callback intercambia `code` por token.
3. Token de usuario se **cifra** y se guarda en `meta_conexiones.token_cifrado`.
4. Frontend lista **páginas** y **ad accounts**; el usuario elige ambas.
5. Se persisten `page_id` / `page_nombre` y `ad_account_id` / `ad_account_nombre`.
6. (Recomendado) Suscribir esa página al webhook de la App.

### 8.2 Webhook (sin colas)

**URL pública (cuando haya dominio):**

```
https://{dominio}/api/meta/webhooks?token={META_WEBHOOK_URL_TOKEN}
```

Ejemplo: `https://midominio.com/api/meta/webhooks?token=...`

| Pieza | Rol |
|-------|-----|
| Path `/api/meta/webhooks` | Endpoint Nest (`GET` verify + `POST` eventos) |
| Query `token` | Candado extra tuyo: si no coincide con env `META_WEBHOOK_URL_TOKEN` → rechazo |
| `hub.verify_token` (GET de Meta) | Verify token de la App; comparar con `META_VERIFY_TOKEN` |
| Header `X-Hub-Signature-256` (POST) | Firma HMAC del body con App Secret |

Flujo:

1. `GET` — Meta manda `hub.mode`, `hub.verify_token`, `hub.challenge`. Validar `?token=` + `hub.verify_token` → devolver `hub.challenge`.
2. `POST` — Validar `?token=` + firma. Si es leadgen: `page_id` → org → fetch Graph `/{leadgen_id}`.
3. Resuelve/crea `campanas` → `conjuntos_anuncios` → `anuncios`.
4. Upsert `leads` por (`organizacion_id`, `id_externo`). `usuario_creacion` = null (sistema).
5. Responder 200 rápido. Si Graph falla, log + 5xx para que Meta reintente.

> El `?token=` **no sustituye** la firma ni el `page_id`. Es un candado sobre la URL. El tenant siempre se resuelve por `page_id`.

### 8.3 Enrutado del webhook → organización (`page_id`)

Cuando Meta envía un lead, el payload trae el **ID de la Página de Facebook** (`page_id`), no tu `organizacion_id`. Hay que resolver:

```
Meta webhook (page_id + leadgen_id)
        ↓
Validar ?token= de la URL + firma
        ↓
Buscar meta_conexiones WHERE page_id = ? AND estado = 1
        ↓
organizacion_id de esa fila
        ↓
Guardar lead en esa empresa
```

Por eso, al conectar Meta, además de la cuenta publicitaria se debe guardar (y preferiblemente suscribir al webhook) la **Página** usada en Lead Ads:

| Campo en `meta_conexiones` | Para qué |
|----------------------------|----------|
| `page_id` | Enrutar el webhook a la org correcta (A vs B) |
| `ad_account_id` | Contexto de anuncios / listados |
| `webhook_verify_token` | Validar el challenge GET de Meta (app o por org) |

**Regla MVP:** `page_id` único entre conexiones activas (`estado = 1`). Una página no puede pertenecer a dos empresas a la vez.

### 8.4 Despliegue HTTPS (OAuth / webhook)

No bloquea las fases 0–6. **Sí hace falta** al llegar a Meta (fases 7–9).

| Uso | URL (cuando exista dominio) |
|-----|-----------------------------|
| Webhook | `https://{dominio}/api/meta/webhooks?token=...` |
| OAuth callback | `https://{dominio}/api/meta/oauth/callback` |

Hasta entonces: API local. Al tocar Meta: dominio HTTPS real o túnel al mismo path. El hosting se decide después; el **path y contrato** ya quedan fijos aquí.

```env
META_APP_ID=
META_APP_SECRET=
META_VERIFY_TOKEN=
META_WEBHOOK_URL_TOKEN=
META_OAUTH_REDIRECT_URI=https://{dominio}/api/meta/oauth/callback
FRONTEND_URL=https://{dominio-app}
```

---

## 9. Pantallas

### Cliente

| Ruta | Contenido |
|------|-----------|
| `/login` | Auth (sin registro público) |
| `/leads` | Listado, búsqueda, filtros (fecha, campaña, anuncio, formulario), detalle |
| `/dashboard` | KPI: total, hoy, semana, mes (**día calendario en `America/Lima`**). Charts: por día, campaña, anuncio. Filtros: fecha, campaña, ad set, anuncio |
| `/settings` | Datos de org + conexión Meta (conectar / página / cuenta / estado) |

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

### Fase 6 — Auth UI cliente

Login, sesión (cookie httpOnly o memoria + refresh), layout protegido, menú según módulos. Sin `/register`.

**Done cuando:** el flujo login (usuario creado por admin) → dashboard vacío funciona en el navegador.

### Fase 7 — OAuth Meta + conexión

`meta/connections`: URL OAuth, callback, cifrado de token, selección de **página** (`page_id`) + cuenta publicitaria, persistencia. Requiere URL HTTPS alcanzable (túnel o deploy).

**Done cuando:** una org de desarrollo queda con `meta_conexiones` activa (`estado = 1`, `page_id` y `ad_account_id` llenos) y `token_cifrado` no es legible en Prisma Studio.

### Fase 8 — Modelo Meta (tablas + lectura)

Schema `campanas`, `conjuntos_anuncios`, `anuncios` (con auditoría). Endpoints de lectura mínimos (para filtros). Poblado inicial **desde el webhook / lead**, no un sync masivo.

**Done cuando:** las FKs existen y un lead puede colgarse de campaña / conjunto / anuncio.

### Fase 9 — Webhook de leads

Verify + firma + fetch Graph + resolver org por `page_id` → upsert `leads`. Sin Redis. Misma URL HTTPS pública que OAuth.

**Done cuando:** un lead de prueba (o del test tool de Meta) aparece en Neon con `datos_crudos`, `id_externo` y `organizacion_id` correcto.

### Fase 10 — Pantalla `/leads`

Listado, búsqueda, filtros, detalle. API paginada.

**Done cuando:** un `USUARIO` de la org ve solo sus leads; org B no aparece.

### Fase 11 — Dashboard KPI

KPIs + 3 gráficos + filtros. Copiar charts de `free-nextjs-admin-dashboard-main` a `src/components/charts/`. Rangos “hoy/semana/mes” y buckets diarios calculados en `America/Lima`.

**Done cuando:** los números coinciden con el listado de leads para el mismo rango/filtro (misma zona Lima).

---

## 11. Fuera de alcance (post-MVP)

- Invitaciones self-serve / registro público
- Selector multi-organización (cambiar org activa) — hoy: primera membresía en login
- Billing / `subscriptions/`
- CRM, WhatsApp, Automatizaciones (solo filas en catálogo)
- Redis, BullMQ, workers
- Sync de métricas publicitarias (inversión, CPL, CTR, ROAS)
- Ads manager (crear campañas)
- Pipeline, tareas, oportunidades
- App móvil

Cuando se agregue un módulo nuevo: fila en `modulos` + `organizacion_modulos` + carpeta Nest + entrada de menú. **No se toca el kernel** (`usuarios` / `organizaciones` / guards).

---

## 12. Decisiones técnicas cerradas para el MVP

| Tema | Decisión |
|------|----------|
| Alta de empresas | **Solo admin de plataforma** (`/admin`). Sin registro público que cree orgs |
| Alta de usuarios | Solo admin de plataforma en el MVP (asigna org + rol) |
| Auth pública | Solo `login` / `refresh` / `logout` |
| Webhook → org | Lookup `meta_conexiones.page_id` → `organizacion_id` |
| Webhook URL | `https://{dominio}/api/meta/webhooks?token=...` (+ verify de Meta + firma) |
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

## 13. Checklist de cierre del MVP

- [x] Neon + Prisma migrado y seedeado (tablas §4 + auditoría)
- [x] Login / logout / refresh (sin register público)
- [x] Admin crea empresas y usuarios
- [x] Request context: `usuarioId`, `organizacionId`, `rol`
- [x] Aislamiento: org A no ve datos de org B
- [ ] Soft delete: listados con `estado = 1`
- [x] Módulos `META_LEADS` y `DASHBOARD` activos por defecto
- [x] Guards de membresía, rol y módulo
- [x] `/admin` gestiona empresas, usuarios, módulos y módulos-por-empresa
- [ ] OAuth Meta + `page_id` + ad account + `token_cifrado`
- [ ] Webhook enruta por `page_id` y guarda `leads` con origen
- [ ] `/leads` con listado, búsqueda, filtros y detalle
- [ ] `/dashboard` con 4 KPIs y 3 gráficos + filtros
- [ ] `npm run build` en backend y frontend
- [ ] Rotar `SEED_ADMIN_PASSWORD` (tras primer login real)

---

## 14. Cómo usar este plan

1. Implementar **solo la fase en curso**.
2. No mezclar Meta (fase 7+) con el kernel (fases 0–5).
3. Cada fase termina con `npm run build` en el repo tocado.
4. Si una fase crece, se parte; no se salta el criterio de “done”.

**Siguiente paso concreto:** Fase 6 (Auth UI cliente: login + sesión + layout protegido + menú por módulos).
