import { Logger } from '@nestjs/common';
import { extraerEventosCuentaWhatsApp } from './whatsapp-webhook-cuenta';
import { CAMPOS_WEBHOOK_WHATSAPP_TODOS } from '../../../whatsapp/connections/domain/campos-webhook-whatsapp';

function payload(field: string, value: unknown) {
  return { entry: [{ id: 'waba-1', changes: [{ field, value }] }] };
}

function unico(field: string, value: unknown) {
  const { cuenta } = extraerEventosCuentaWhatsApp(payload(field, value));
  expect(cuenta).toHaveLength(1);
  return cuenta[0];
}

describe('Webhook WhatsApp: campos de cuenta (formatos Graph v26)', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('ningún campo del catálogo queda como desconocido', () => {
    for (const campo of CAMPOS_WEBHOOK_WHATSAPP_TODOS) {
      extraerEventosCuentaWhatsApp(payload(campo, {}));
    }
    expect((Logger.prototype.warn as jest.Mock).mock.calls).toEqual([]);
  });

  it('un campo nuevo de Meta se registra como warning', () => {
    extraerEventosCuentaWhatsApp(payload('campo_inventado', {}));
    expect(
      JSON.stringify((Logger.prototype.warn as jest.Mock).mock.calls),
    ).toContain('campo_inventado');
  });

  it('account_update ACCOUNT_OFFBOARDED marca la línea desconectada y es crítico', () => {
    const evento = unico('account_update', { event: 'ACCOUNT_OFFBOARDED' });
    expect(evento).toMatchObject({
      wabaId: 'waba-1',
      severidad: 'critica',
      notificar: true,
      cambiosLinea: { estadoNumero: 'DISCONNECTED' },
    });
  });

  it('PARTNER_REMOVED explica el motivo de desconexión de coexistencia', () => {
    const evento = unico('account_update', {
      event: 'PARTNER_REMOVED',
      waba_info: { waba_id: 'waba-1' },
      disconnection_info: {
        reason: 'PRIMARY_INACTIVITY',
        initiated_by: 'SYSTEM',
      },
    });
    expect(evento.cambiosLinea).toEqual({ estadoNumero: 'DISCONNECTED' });
    expect(evento.mensaje).toContain('inactiva');
  });

  it('ACCOUNT_RECONNECTED vuelve a marcar la línea conectada', () => {
    expect(
      unico('account_update', { event: 'ACCOUNT_RECONNECTED' }).cambiosLinea,
    ).toEqual({ estadoNumero: 'CONNECTED' });
  });

  it('eventos informativos de account_update no notifican', () => {
    expect(
      unico('account_update', { event: 'VOLUME_BASED_PRICING_TIER_UPDATE' })
        .notificar,
    ).toBe(false);
  });

  it('nombre visible aprobado actualiza nombreVerificado de la línea', () => {
    const evento = unico('phone_number_name_update', {
      display_phone_number: '51987654321',
      decision: 'APPROVED',
      requested_verified_name: 'Domaria',
      rejection_reason: null,
    });
    expect(evento.numeroDisplay).toBe('51987654321');
    expect(evento.cambiosLinea).toEqual({ nombreVerificado: 'Domaria' });
  });

  it('plantilla rechazada notifica con motivo; PENDING no', () => {
    const rechazada = unico('message_template_status_update', {
      event: 'REJECTED',
      message_template_name: 'bienvenida',
      message_template_language: 'es',
      reason: 'INVALID_FORMAT',
      rejection_info: { reason: 'Variables mal formadas' },
    });
    expect(rechazada.severidad).toBe('advertencia');
    expect(rechazada.mensaje).toContain('formato inválido');
    expect(rechazada.mensaje).toContain('Variables mal formadas');
    expect(
      unico('message_template_status_update', { event: 'PENDING' }).notificar,
    ).toBe(false);
  });

  it('account_alerts de un número usa entity_id como phone_number_id', () => {
    const evento = unico('account_alerts', {
      entity_type: 'PHONE_NUMBER',
      entity_id: 'phone-9',
      alert_info: {
        alert_severity: 'CRITICAL',
        alert_status: 'ACTIVE',
        alert_type: 'OBA_REJECTED',
        alert_description: 'Official business accounts are not granted.',
      },
    });
    expect(evento.phoneNumberId).toBe('phone-9');
    expect(evento.severidad).toBe('critica');
  });

  it('security PIN_RESET_REQUEST es crítico', () => {
    expect(
      unico('security', {
        display_phone_number: '51987654321',
        event: 'PIN_RESET_REQUEST',
        requester: '123',
      }).severidad,
    ).toBe('critica');
  });

  it('smb_app_state_sync separa contactos agregados y borrados', () => {
    const { contactos, cuenta } = extraerEventosCuentaWhatsApp(
      payload('smb_app_state_sync', {
        metadata: { phone_number_id: 'phone-1' },
        state_sync: [
          {
            type: 'contact',
            action: 'add',
            contact: { full_name: 'Ana', phone_number: '+51 900 000 001' },
          },
          {
            type: 'contact',
            action: 'remove',
            contact: { phone_number: '51900000002' },
          },
        ],
      }),
    );
    expect(cuenta).toEqual([]);
    expect(contactos).toEqual([
      {
        phoneNumberId: 'phone-1',
        waId: '51900000001',
        nombre: 'Ana',
        accion: 'add',
      },
      {
        phoneNumberId: 'phone-1',
        waId: '51900000002',
        nombre: null,
        accion: 'remove',
      },
    ]);
  });

  it('user_preferences acepta BSUID sin teléfono', () => {
    const { preferencias } = extraerEventosCuentaWhatsApp(
      payload('user_preferences', {
        metadata: { phone_number_id: 'phone-1' },
        user_preferences: [
          {
            user_id: 'PE.bsuid',
            category: 'marketing_messages',
            value: 'resume',
            timestamp: 1790866800,
          },
        ],
      }),
    );
    expect(preferencias).toEqual([
      {
        phoneNumberId: 'phone-1',
        waId: null,
        bsuid: 'PE.bsuid',
        valor: 'resume',
        fecha: new Date(1790866800 * 1000),
      },
    ]);
  });

  it('ignora los campos de mensajería (los procesa extraerEventosWhatsApp)', () => {
    const resultado = extraerEventosCuentaWhatsApp(
      payload('messages', { messages: [] }),
    );
    expect(resultado).toEqual({ cuenta: [], contactos: [], preferencias: [] });
  });
});
