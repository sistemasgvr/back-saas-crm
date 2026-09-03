# Guía — Configurar Webhooks Meta (Lead Ads + WhatsApp)

Checklist operativo para la app de Meta del CRM.  
**Repos:** `back-saas-crm` (endpoint público) · Meta Developers.

> La pantalla **Webhooks** es la correcta.  
> **No uses Catalog.** Para leads elige **Page**. Para chats elige **WhatsApp Business Account**.

---

## 1. Datos que necesitas (anótalos antes)

| Dato | Dónde está | Ejemplo |
|------|------------|---------|
| Dominio del backend | Deploy (Vercel, etc.) | `https://back-saas-crm.vercel.app` |
| `META_WEBHOOK_URL_TOKEN` | `.env` del backend (prod) | string secreto ≥ 8 chars |
| Verify token | Preferido: `webhook_verify_token` de la org en BD · Fallback: `META_VERIFY_TOKEN` del `.env` | el mismo string que Meta pedirá en el challenge |

### Callback URL (copiar tal cual)

```text
https://back-saas-crm.vercel.app/api/meta/webhooks?token=PEGAR_AQUI_META_WEBHOOK_URL_TOKEN
```

Sustituye `PEGAR_AQUI_META_WEBHOOK_URL_TOKEN` por el valor real del env de **producción**.  
Si tu dominio de API es otro, cambia solo el host; el path debe ser `/api/meta/webhooks?token=...`.

### Verify token (Identificador / Token de verificación)

Usa **el mismo** valor que el backend acepta:

1. Ideal: el `webhook_verify_token` de la organización (se genera al crear la conexión Meta / org).
2. Si aún no lo tienes a mano: el `META_VERIFY_TOKEN` del `.env` de prod (fallback del backend).

El backend valida GET de suscripción con ese token. Si no coinciden, **Verificar y guardar** fallará.

---

## 2. Dónde estás ahora (y qué cambiar)

En Meta Developers → tu app → **Webhooks** (o Casos de uso → Personalizar → Webhooks).

En la columna **Producto** verás algo como:

- Catalog ← **no** (es lo que suele venir seleccionado)
- User ← no (para este smoke)
- **Page** ← **sí, para Lead Ads**
- WhatsApp Business Account ← **sí, después, para chats**
- Ad Account / Instagram / etc. ← no necesarios ahora

**Paso inmediato:** haz clic en **Page**.

---

## 3. Configurar webhook de **Page** (leads)

1. Producto: **Page**.
2. **URL de devolución de llamada** = Callback URL de la §1.
3. **Token / Identificador de verificación** = verify token de la §1.
4. Deja apagado el certificado de cliente (no lo usamos).
5. Pulsa **Verificar y guardar**.
   - Meta hace un `GET` a tu backend con `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`.
   - Si el backend responde 200 con el challenge, Meta guarda la URL.
6. En **Campos de webhook**, busca y suscribe **`leadgen`** (toggle a suscrito).
7. (Opcional) Versión Graph: no hace falta v20; el CRM usa `META_GRAPH_VERSION` (p. ej. v26.0) en las llamadas API; el webhook de suscripción acepta el challenge igual.

### Aviso “app sin publicar”

Es normal en desarrollo: Meta puede limitar notificaciones reales.  
Como admin/desarrollador/tester de la app **sí** puedes probar leads (Lead Ads Testing Tool o página de prueba).  
Para clientes reales: publicar la app + App Review de permisos.

### Checklist Page

- [ ] Producto = **Page** (no Catalog)
- [ ] Callback URL con `?token=` correcto
- [ ] Verify token = el del backend/org
- [ ] **Verificar y guardar** OK (sin error)
- [ ] Campo **`leadgen`** suscrito

---

## 4. Configurar webhook de **WhatsApp Business Account** (chats)

Hazlo **después** de tener WABA + número en Business Manager y el módulo WhatsApp en el CRM.

1. Misma pantalla Webhooks → producto **WhatsApp Business Account**.
2. Misma **Callback URL** y el **mismo verify token** (un solo endpoint sirve para Page y WABA).
3. **Verificar y guardar**.
4. Suscribir campos relevantes, como mínimo:
   - **`messages`** (mensajes entrantes / estados)
   - **`smb_message_echoes`** (coexistencia: lo que mandan desde la app WhatsApp Business en el celular)
   - Si aparecen: estados de entrega (`message_status` / similares según la UI actual de Meta)

### Checklist WhatsApp

- [ ] Producto = **WhatsApp Business Account**
- [ ] Misma Callback URL + verify token
- [ ] Verificar y guardar OK
- [ ] Campo **`messages`** suscrito
- [ ] Campo **`smb_message_echoes`** suscrito (si usan coexistencia / app móvil)
- [ ] En CRM: `/settings/whatsapp` con número vinculado

---

## 5. Completar en el CRM (sin esto el webhook no “llega” a una org)

Aunque Meta tenga la URL bien, el CRM enruta por página / WABA:

### Leads (Page)

1. `/settings/meta` → OAuth conectado.
2. Vincular la **página** de Lead Ads.
3. Perfil de página → estado **Suscrito** (o **Re-suscribir webhook**).
4. **Verificar en Meta**.
5. Generar un lead de prueba → debe aparecer en `/leads`.

### WhatsApp

1. Módulo `WHATSAPP` habilitado en la org.
2. `/settings/whatsapp` → vincular número.
3. Lead con teléfono → iniciar chat / plantilla → respuesta del cliente en `/chats`.

---

## 6. Errores frecuentes

| Síntoma | Causa típica |
|---------|----------------|
| “Verificar y guardar” falla | Token URL (`?token=`) distinto al env, o verify token distinto al backend |
| 403 en challenge | `META_WEBHOOK_URL_TOKEN` o verify token incorrectos |
| Verify OK pero no llegan leads | Falta suscribir **`leadgen`**, o la página no está vinculada/suscrita en el CRM |
| Suscribiste **Catalog** | No sirve para Lead Ads; cambia a **Page** |
| App “Sin publicar” | Solo testers/admins; OK para smoke interno |

---

## 7. Orden recomendado hoy

1. Anotar Callback URL + verify token (§1).
2. En Meta: **Page** → Verificar y guardar → suscribir **`leadgen`**.
3. En CRM: conectar Meta + vincular página + Verificar en Meta.
4. Lead de prueba → `/leads`.
5. Más adelante: **WhatsApp Business Account** → `messages` → vincular número → `/chats`.

---

*Guía alineada a `PLAN.md` §8 (webhook) y fases 17–19. Un solo endpoint: `GET/POST /api/meta/webhooks?token=...`.*
