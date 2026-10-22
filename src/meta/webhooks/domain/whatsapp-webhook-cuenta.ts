import { Logger } from '@nestjs/common';
import {
  CAMPOS_WEBHOOK_WHATSAPP_CALLING,
  CAMPOS_WEBHOOK_WHATSAPP_INFORMATIVOS,
} from '../../../whatsapp/connections/domain/campos-webhook-whatsapp';

const logger = new Logger('WhatsappWebhookCuenta');

/**
 * Campos del webhook WhatsApp Business Account que NO son mensajes: estado de
 * la cuenta/número, plantillas, alertas, seguridad, contactos de la app
 * Business y preferencias de marketing. Formatos según la referencia oficial
 * de webhooks (developers.facebook.com/documentation/business-messaging/
 * whatsapp/webhooks/reference/<campo>). Los de mensajería (messages, ecos,
 * history, calls) los procesa extraerEventosWhatsApp.
 *
 * Para soportar un campo nuevo: agregar su caso en `eventoDeCampo` y el campo
 * en campos-webhook-whatsapp.ts (para que la verificación lo sugiera).
 */

export type SeveridadEventoCuenta = 'critica' | 'advertencia' | 'info';

export interface EventoCuentaWhatsApp {
  campo: string;
  /** entry.id — el WABA que notifica Meta. */
  wabaId: string | null;
  phoneNumberId: string | null;
  /** Número visible que trae Meta: elige la línea dentro del WABA. */
  numeroDisplay: string | null;
  evento: string | null;
  severidad: SeveridadEventoCuenta;
  titulo: string;
  mensaje: string;
  /** false = solo queda en el log del servidor. */
  notificar: boolean;
  /** Cambios a aplicar en las líneas vinculadas afectadas. */
  cambiosLinea?: { estadoNumero?: string; nombreVerificado?: string };
}

/** smb_app_state_sync: contacto guardado/editado/borrado en la app Business. */
export interface EventoContactoAppWhatsApp {
  phoneNumberId: string;
  waId: string;
  nombre: string | null;
  accion: 'add' | 'remove';
}

/** user_preferences: el contacto pidió dejar o volver a recibir marketing. */
export interface EventoPreferenciaMarketingWhatsApp {
  phoneNumberId: string;
  waId: string | null;
  bsuid: string | null;
  valor: 'stop' | 'resume';
  fecha: Date;
}

interface PayloadConCampos {
  entry?: {
    id?: string;
    changes?: { field?: string; value?: unknown }[];
  }[];
}

interface ValorCuentaCrudo {
  metadata?: { phone_number_id?: string; display_phone_number?: string };
  event?: string;
  decision?: string;
  display_phone_number?: string;
  phone_number?: string;
  ban_info?: { waba_ban_state?: string; waba_ban_date?: string };
  violation_info?: { violation_type?: string };
  restriction_info?: {
    restriction_type?: string;
    expiration?: number;
    remediation?: string;
  }[];
  disconnection_info?: { reason?: string; initiated_by?: string };
  current_limit?: string;
  max_daily_conversations_per_business?: string;
  requested_verified_name?: string;
  rejection_reason?: string | null;
  message_template_name?: string;
  message_template_language?: string;
  reason?: string | null;
  rejection_info?: { reason?: string; recommendation?: string };
  other_info?: { title?: string; description?: string };
  previous_quality_score?: string;
  new_quality_score?: string;
  previous_category?: string;
  new_category?: string;
  correct_category?: string;
  entity_type?: string;
  entity_id?: string;
  alert_info?: {
    alert_severity?: string;
    alert_status?: string;
    alert_type?: string;
    alert_description?: string;
  };
  state_sync?: {
    type?: string;
    contact?: {
      full_name?: string;
      first_name?: string;
      phone_number?: string;
    };
    action?: string;
  }[];
  user_preferences?: {
    wa_id?: string;
    user_id?: string;
    category?: string;
    value?: string;
    timestamp?: number | string;
  }[];
  automatic_events?: { event_name?: string }[];
}

/** Los procesa extraerEventosWhatsApp (mensajes y llamadas). */
const CAMPOS_MENSAJERIA = new Set([
  'messages',
  'smb_message_echoes',
  'history',
  'calls',
]);

const CAMPOS_SOLO_LOG = new Set<string>([
  ...CAMPOS_WEBHOOK_WHATSAPP_INFORMATIVOS,
  ...CAMPOS_WEBHOOK_WHATSAPP_CALLING.filter((c) => c !== 'calls'),
]);

const LIMITES: Record<string, string> = {
  TIER_50: '50 conversaciones por día',
  TIER_250: '250 conversaciones por día',
  TIER_1K: '1.000 conversaciones por día',
  TIER_2K: '2.000 conversaciones por día',
  TIER_10K: '10.000 conversaciones por día',
  TIER_100K: '100.000 conversaciones por día',
  TIER_UNLIMITED: 'sin límite',
  TIER_NOT_SET: 'sin asignar (aún no envía mensajes)',
};

const MOTIVOS_PLANTILLA: Record<string, string> = {
  ABUSIVE_CONTENT: 'contenido abusivo',
  CATEGORY_NOT_AVAILABLE: 'categoría no disponible',
  INCORRECT_CATEGORY: 'categoría incorrecta',
  INVALID_FORMAT: 'formato inválido',
  PROMOTIONAL: 'contenido promocional',
  SCAM: 'posible estafa',
  TAG_CONTENT_MISMATCH: 'el contenido no coincide con la categoría',
};

const MOTIVOS_NOMBRE: Record<string, string> = {
  NAME_EMPLOYEE_ISSUE: 'parece el nombre de un empleado',
  NAME_ENDCLIENT_NOTRELATED: 'no se relaciona con el negocio',
  NAME_FORMAT_UNACCEPTABLE: 'formato no aceptado',
  NAME_INDIVIDUAL_ISSUE: 'parece el nombre de una persona',
  NAME_NOT_CONSISTENT: 'no coincide con la marca o el sitio del negocio',
};

const MOTIVOS_DESCONEXION: Record<string, string> = {
  ACCOUNT_DISCONNECTED: 'la cuenta se desconectó',
  BUSINESS_DOWNGRADE: 'el número dejó de usar WhatsApp Business',
  CHANGE_NUMBER: 'se cambió el número en la app',
  COMPANION_INACTIVITY: 'inactividad de un dispositivo vinculado',
  PRIMARY_INACTIVITY:
    'la app WhatsApp Business del celular estuvo inactiva demasiado tiempo',
  USER_RE_REGISTERED: 'el número se registró de nuevo en la app',
};

const NOTA_COEXISTENCIA =
  'Los mensajes de la app WhatsApp Business dejarán de llegar al CRM hasta reconectar el número desde Meta.';

function describirLimite(tier?: string): string | null {
  if (!tier) return null;
  return LIMITES[tier] ?? tier;
}

function texto(...partes: (string | null | undefined | false)[]): string {
  return partes.filter(Boolean).join(' ').slice(0, 500);
}

function linea(numero: string | null): string {
  return numero ? `el número ${numero}` : 'la cuenta de WhatsApp';
}

type Base = Pick<
  EventoCuentaWhatsApp,
  'campo' | 'wabaId' | 'phoneNumberId' | 'numeroDisplay' | 'evento'
>;

function accountUpdate(base: Base, v: ValorCuentaCrudo): EventoCuentaWhatsApp {
  const quien = linea(base.numeroDisplay);
  const ev = base.evento ?? '';
  switch (ev) {
    case 'ACCOUNT_OFFBOARDED':
      return {
        ...base,
        severidad: 'critica',
        titulo: 'WhatsApp: coexistencia desconectada',
        mensaje: texto(
          `Meta desvinculó ${quien} de la plataforma.`,
          NOTA_COEXISTENCIA,
        ),
        notificar: true,
        cambiosLinea: { estadoNumero: 'DISCONNECTED' },
      };
    case 'ACCOUNT_RECONNECTED':
      return {
        ...base,
        severidad: 'info',
        titulo: 'WhatsApp: coexistencia reconectada',
        mensaje: texto(`Meta volvió a conectar ${quien} con la plataforma.`),
        notificar: true,
        cambiosLinea: { estadoNumero: 'CONNECTED' },
      };
    case 'PARTNER_REMOVED': {
      const motivo = v.disconnection_info?.reason;
      return {
        ...base,
        severidad: 'critica',
        titulo: 'WhatsApp: la plataforma perdió acceso al número',
        mensaje: texto(
          `Se quitó el acceso de la app a ${quien}`,
          motivo ? `(motivo: ${MOTIVOS_DESCONEXION[motivo] ?? motivo}).` : '.',
          NOTA_COEXISTENCIA,
        ),
        notificar: true,
        cambiosLinea: { estadoNumero: 'DISCONNECTED' },
      };
    }
    case 'PARTNER_APP_UNINSTALLED':
      return {
        ...base,
        severidad: 'critica',
        titulo: 'WhatsApp: app de Meta desinstalada de la cuenta',
        mensaje: texto(
          'Se desinstaló una app de la cuenta de WhatsApp Business. Si era la app del CRM, los mensajes dejarán de llegar: vuelve a vincular el número.',
        ),
        notificar: true,
      };
    case 'ACCOUNT_DELETED':
      return {
        ...base,
        severidad: 'critica',
        titulo: 'WhatsApp: cuenta eliminada',
        mensaje: 'Meta informó que la cuenta de WhatsApp Business se eliminó.',
        notificar: true,
        cambiosLinea: { estadoNumero: 'DISCONNECTED' },
      };
    case 'DISABLED_UPDATE': {
      const estado = v.ban_info?.waba_ban_state;
      const fecha = v.ban_info?.waba_ban_date;
      if (estado === 'REINSTATE') {
        return {
          ...base,
          severidad: 'info',
          titulo: 'WhatsApp: cuenta reactivada',
          mensaje: 'Meta reactivó la cuenta de WhatsApp Business.',
          notificar: true,
        };
      }
      return {
        ...base,
        severidad: 'critica',
        titulo:
          estado === 'SCHEDULE_FOR_DISABLE'
            ? 'WhatsApp: cuenta programada para deshabilitarse'
            : 'WhatsApp: cuenta deshabilitada',
        mensaje: texto(
          estado === 'SCHEDULE_FOR_DISABLE'
            ? 'Meta programó deshabilitar la cuenta de WhatsApp Business'
            : 'Meta deshabilitó la cuenta de WhatsApp Business',
          fecha ? `(fecha: ${fecha}).` : '.',
          'Revisa la Calidad de la cuenta en WhatsApp Manager.',
        ),
        notificar: true,
      };
    }
    case 'ACCOUNT_VIOLATION':
      return {
        ...base,
        severidad: 'critica',
        titulo: 'WhatsApp: infracción de políticas',
        mensaje: texto(
          `Meta registró una infracción en ${quien}`,
          v.violation_info?.violation_type
            ? `(${v.violation_info.violation_type}).`
            : '.',
          'Revisa la Calidad de la cuenta en WhatsApp Manager.',
        ),
        notificar: true,
      };
    case 'ACCOUNT_RESTRICTION': {
      const restricciones = (v.restriction_info ?? [])
        .map((r) => r.restriction_type)
        .filter(Boolean)
        .join(', ');
      return {
        ...base,
        severidad: 'critica',
        titulo: 'WhatsApp: cuenta restringida',
        mensaje: texto(
          `Meta restringió ${quien}`,
          restricciones ? `(${restricciones}).` : '.',
          v.restriction_info?.[0]?.remediation,
        ),
        notificar: true,
      };
    }
    case 'PARTNER_ADDED':
    case 'PARTNER_APP_INSTALLED':
    case 'AD_ACCOUNT_LINKED':
    case 'MM_LITE_TERMS_SIGNED':
    case 'BUSINESS_PRIMARY_LOCATION_COUNTRY_UPDATE':
    case 'AUTH_INTL_PRICE_ELIGIBILITY_UPDATE':
    case 'VOLUME_BASED_PRICING_TIER_UPDATE':
    case 'PARTNER_CLIENT_CERTIFICATION_STATUS_UPDATE':
      return {
        ...base,
        severidad: 'info',
        titulo: 'WhatsApp: actualización de la cuenta',
        mensaje: `Meta informó ${ev} en la cuenta de WhatsApp Business.`,
        notificar: false,
      };
    default:
      // Evento nuevo de Meta: se avisa por si es relevante.
      return {
        ...base,
        severidad: 'advertencia',
        titulo: 'WhatsApp: cambio en la cuenta',
        mensaje: `Meta informó el evento ${ev || 'desconocido'} en la cuenta de WhatsApp Business. Revisa WhatsApp Manager.`,
        notificar: true,
      };
  }
}

function plantillaStatus(
  base: Base,
  v: ValorCuentaCrudo,
): EventoCuentaWhatsApp {
  const nombre = `«${v.message_template_name ?? 'sin nombre'}» (${v.message_template_language ?? '?'})`;
  const ev = base.evento ?? '';
  const motivo = v.reason ? MOTIVOS_PLANTILLA[v.reason] : undefined;
  const titulos: Record<string, [SeveridadEventoCuenta, string]> = {
    APPROVED: ['info', 'Plantilla aprobada'],
    REINSTATED: ['info', 'Plantilla reactivada'],
    UNARCHIVED: ['info', 'Plantilla desarchivada'],
    REJECTED: ['advertencia', 'Plantilla rechazada'],
    PAUSED: ['advertencia', 'Plantilla pausada'],
    DISABLED: ['advertencia', 'Plantilla deshabilitada'],
    FLAGGED: ['advertencia', 'Plantilla marcada por baja calidad'],
    LOCKED: ['advertencia', 'Plantilla bloqueada'],
    LIMIT_EXCEEDED: ['advertencia', 'Límite de plantillas alcanzado'],
  };
  const conocido = titulos[ev];
  return {
    ...base,
    severidad: conocido?.[0] ?? 'info',
    titulo: `WhatsApp: ${conocido?.[1] ?? `plantilla ${ev.toLowerCase()}`}`,
    mensaje: texto(
      `Plantilla ${nombre}: ${ev}.`,
      motivo && `Motivo: ${motivo}.`,
      v.rejection_info?.reason,
      v.rejection_info?.recommendation,
      v.other_info?.description,
    ),
    // PENDING, IN_APPEAL, ARCHIVED, DELETED… no requieren acción.
    notificar: Boolean(conocido),
  };
}

function plantillaCalidad(
  base: Base,
  v: ValorCuentaCrudo,
): EventoCuentaWhatsApp {
  const nueva = v.new_quality_score ?? 'UNKNOWN';
  const previa = v.previous_quality_score ?? 'UNKNOWN';
  const mala = nueva === 'RED' || nueva === 'YELLOW';
  const nombres: Record<string, string> = {
    GREEN: 'alta',
    YELLOW: 'media',
    RED: 'baja',
    UNKNOWN: 'pendiente',
  };
  return {
    ...base,
    evento: nueva,
    severidad: mala ? 'advertencia' : 'info',
    titulo: 'WhatsApp: cambió la calidad de una plantilla',
    mensaje: `Plantilla «${v.message_template_name ?? 'sin nombre'}»: calidad ${nombres[previa] ?? previa} → ${nombres[nueva] ?? nueva}.`,
    notificar: mala || (nueva === 'GREEN' && previa !== 'UNKNOWN'),
  };
}

function eventoDeCampo(
  campo: string,
  wabaId: string | null,
  v: ValorCuentaCrudo,
): EventoCuentaWhatsApp | null {
  const numeroDisplay =
    v.display_phone_number ??
    v.phone_number ??
    v.metadata?.display_phone_number ??
    null;
  const base: Base = {
    campo,
    wabaId,
    phoneNumberId: v.metadata?.phone_number_id ?? null,
    numeroDisplay,
    evento: v.event ?? v.decision ?? null,
  };

  switch (campo) {
    case 'account_update':
      return accountUpdate(base, v);

    case 'phone_number_quality_update': {
      const limite = describirLimite(
        v.max_daily_conversations_per_business ?? v.current_limit,
      );
      const ev = base.evento ?? '';
      const baja = ev === 'FLAGGED' || ev === 'DOWNGRADE';
      return {
        ...base,
        severidad: baja ? 'advertencia' : 'info',
        titulo: baja
          ? 'WhatsApp: bajó la calidad del número'
          : 'WhatsApp: cambió el límite de mensajería',
        mensaje: texto(
          `Meta informó ${ev} para ${linea(numeroDisplay)}.`,
          limite && `Límite actual: ${limite}.`,
        ),
        // ONBOARDING = el número aún se está registrando.
        notificar: ev !== 'ONBOARDING',
      };
    }

    case 'phone_number_name_update': {
      const decision = base.evento ?? '';
      const nombre = v.requested_verified_name ?? '';
      if (decision === 'APPROVED') {
        return {
          ...base,
          severidad: 'info',
          titulo: 'WhatsApp: nombre visible aprobado',
          mensaje: `Meta aprobó el nombre «${nombre}» para ${linea(numeroDisplay)}.`,
          notificar: true,
          cambiosLinea: nombre ? { nombreVerificado: nombre } : undefined,
        };
      }
      const motivo = v.rejection_reason
        ? (MOTIVOS_NOMBRE[v.rejection_reason] ?? v.rejection_reason)
        : null;
      return {
        ...base,
        severidad: decision === 'REJECTED' ? 'advertencia' : 'info',
        titulo:
          decision === 'REJECTED'
            ? 'WhatsApp: nombre visible rechazado'
            : 'WhatsApp: nombre visible en revisión',
        mensaje: texto(
          `Nombre «${nombre}» para ${linea(numeroDisplay)}: ${decision}.`,
          motivo && `Motivo: ${motivo}.`,
        ),
        notificar: decision === 'REJECTED',
      };
    }

    case 'message_template_status_update':
      return plantillaStatus(base, v);

    case 'message_template_quality_update':
      return plantillaCalidad(base, v);

    case 'template_category_update': {
      const nombre = v.message_template_name ?? 'sin nombre';
      return {
        ...base,
        evento: v.correct_category ?? v.new_category ?? null,
        severidad: 'advertencia',
        titulo: 'WhatsApp: cambio de categoría de plantilla',
        mensaje: v.correct_category
          ? `La plantilla «${nombre}» pasará a la categoría ${v.correct_category} en 24 h (cambia su costo).`
          : `La plantilla «${nombre}» cambió de ${v.previous_category ?? '?'} a ${v.new_category ?? '?'} (cambia su costo).`,
        notificar: true,
      };
    }

    case 'account_review_update': {
      const decision = base.evento ?? '';
      return {
        ...base,
        severidad:
          decision === 'REJECTED'
            ? 'critica'
            : decision === 'APPROVED'
              ? 'info'
              : 'advertencia',
        titulo: 'WhatsApp: revisión de la cuenta',
        mensaje:
          decision === 'APPROVED'
            ? 'Meta aprobó la cuenta de WhatsApp Business.'
            : decision === 'REJECTED'
              ? 'Meta rechazó la cuenta de WhatsApp Business: no puede usar la API. Revisa WhatsApp Manager.'
              : `La revisión de la cuenta de WhatsApp Business está ${decision}.`,
        notificar: decision === 'APPROVED' || decision === 'REJECTED',
      };
    }

    case 'account_alerts': {
      const alerta = v.alert_info ?? {};
      const severidad: SeveridadEventoCuenta =
        alerta.alert_severity === 'CRITICAL'
          ? 'critica'
          : alerta.alert_severity === 'WARNING'
            ? 'advertencia'
            : 'info';
      return {
        ...base,
        phoneNumberId:
          v.entity_type === 'PHONE_NUMBER' ? (v.entity_id ?? null) : null,
        evento: alerta.alert_type ?? null,
        severidad,
        titulo: 'WhatsApp: alerta de la cuenta',
        mensaje: texto(
          alerta.alert_description ?? alerta.alert_type ?? 'Alerta de Meta.',
        ),
        notificar: alerta.alert_status !== 'NONE',
      };
    }

    case 'business_capability_update': {
      const limite = describirLimite(v.max_daily_conversations_per_business);
      return {
        ...base,
        evento: v.max_daily_conversations_per_business ?? null,
        severidad: 'info',
        titulo: 'WhatsApp: nuevo límite de mensajería',
        mensaje: limite
          ? `El límite de mensajería del portafolio ahora es: ${limite}.`
          : 'Meta actualizó las capacidades de mensajería del portafolio.',
        notificar: Boolean(limite),
      };
    }

    case 'security': {
      const ev = base.evento ?? '';
      const mensajes: Record<string, string> = {
        PIN_CHANGED:
          'Se cambió o activó el PIN de verificación en dos pasos en WhatsApp Manager.',
        PIN_RESET_REQUEST:
          'Alguien pidió desactivar la verificación en dos pasos en WhatsApp Manager.',
        PIN_REQUEST_SUCCESS:
          'Se desactivó la verificación en dos pasos del número.',
      };
      return {
        ...base,
        severidad: ev === 'PIN_CHANGED' ? 'advertencia' : 'critica',
        titulo: 'WhatsApp: cambio de seguridad',
        mensaje: texto(
          mensajes[ev] ?? `Evento de seguridad ${ev}.`,
          `(${linea(numeroDisplay)})`,
          'Si no fue alguien de tu equipo, revisa los accesos en Meta Business Suite.',
        ),
        notificar: true,
      };
    }

    default:
      return null;
  }
}

/**
 * Separa del payload los eventos de cuenta, contactos de la app Business y
 * preferencias de marketing. Los campos informativos solo se registran en log;
 * uno totalmente desconocido se registra como warning para detectarlo.
 */
export function extraerEventosCuentaWhatsApp(payload: PayloadConCampos): {
  cuenta: EventoCuentaWhatsApp[];
  contactos: EventoContactoAppWhatsApp[];
  preferencias: EventoPreferenciaMarketingWhatsApp[];
} {
  const cuenta: EventoCuentaWhatsApp[] = [];
  const contactos: EventoContactoAppWhatsApp[] = [];
  const preferencias: EventoPreferenciaMarketingWhatsApp[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const campo = change.field;
      if (!campo || CAMPOS_MENSAJERIA.has(campo)) continue;
      const v = (change.value ?? {}) as ValorCuentaCrudo;
      const phoneNumberId = v.metadata?.phone_number_id;

      if (campo === 'smb_app_state_sync') {
        if (!phoneNumberId) continue;
        for (const item of v.state_sync ?? []) {
          const waId = item.contact?.phone_number?.replace(/\D/g, '');
          if (item.type !== 'contact' || !waId) continue;
          const accion = item.action === 'remove' ? 'remove' : 'add';
          contactos.push({
            phoneNumberId,
            waId,
            nombre:
              item.contact?.full_name?.trim() ||
              item.contact?.first_name?.trim() ||
              null,
            accion,
          });
        }
        continue;
      }

      if (campo === 'user_preferences') {
        if (!phoneNumberId) continue;
        for (const pref of v.user_preferences ?? []) {
          if (pref.category && pref.category !== 'marketing_messages') continue;
          if (pref.value !== 'stop' && pref.value !== 'resume') continue;
          const waId = pref.wa_id?.replace(/\D/g, '') || null;
          const bsuid = pref.user_id?.trim() || null;
          if (!waId && !bsuid) continue;
          const segundos = Number(pref.timestamp);
          preferencias.push({
            phoneNumberId,
            waId,
            bsuid,
            valor: pref.value,
            fecha: Number.isFinite(segundos)
              ? new Date(segundos * 1000)
              : new Date(),
          });
        }
        continue;
      }

      if (CAMPOS_SOLO_LOG.has(campo)) {
        const detalle =
          campo === 'automatic_events'
            ? (v.automatic_events ?? []).map((e) => e.event_name).join(',')
            : (v.event ?? '');
        logger.log(
          `Webhook WhatsApp ${campo} recibido (sin acción en el CRM)${detalle ? `: ${detalle}` : ''}`,
        );
        continue;
      }

      const evento = eventoDeCampo(campo, entry.id ?? null, v);
      if (evento) {
        cuenta.push(evento);
      } else {
        logger.warn(`Campo webhook WhatsApp desconocido ignorado: ${campo}`);
      }
    }
  }

  return { cuenta, contactos, preferencias };
}
