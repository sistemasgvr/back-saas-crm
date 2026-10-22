import { of } from 'rxjs';
import type { HttpService } from '@nestjs/axios';
import type { ConfigService } from '@nestjs/config';
import { AxiosMetaGraphClient } from './meta-graph.client';

function fixture() {
  const http = {
    get: jest.fn<unknown, [string, unknown?]>(),
    post: jest
      .fn<unknown, [string, unknown, unknown?]>()
      .mockReturnValue(of({ data: { success: true } })),
  };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const client = new AxiosMetaGraphClient(
    http as unknown as HttpService,
    config as unknown as ConfigService,
  );
  return { client, http };
}

describe('AxiosMetaGraphClient (contratos Graph v26)', () => {
  it('lee la configuración de llamadas desde /{phone}/settings → calling', async () => {
    const { client, http } = fixture();
    http.get.mockReturnValue(
      of({
        data: {
          calling: { status: 'ENABLED', call_icon_visibility: 'DEFAULT' },
          otra_feature: {},
        },
      }),
    );

    const settings = await client.obtenerSettingsLlamadaWhatsApp(
      'phone',
      'tok',
    );

    expect(http.get.mock.calls[0][0]).toBe(
      'https://graph.facebook.com/v26.0/phone/settings',
    );
    expect(settings).toEqual({
      status: 'ENABLED',
      call_icon_visibility: 'DEFAULT',
    });
  });

  it('actualiza llamadas con POST /{phone}/settings y body { calling }', async () => {
    const { client, http } = fixture();

    await client.actualizarSettingsLlamadaWhatsApp('phone', 'tok', {
      status: 'ENABLED',
    });

    expect(http.post.mock.calls[0][0]).toBe(
      'https://graph.facebook.com/v26.0/phone/settings',
    );
    expect(http.post.mock.calls[0][1]).toEqual({
      calling: { status: 'ENABLED' },
    });
  });

  it('manda Conversion Leads con event_source/lead_event_source en custom_data', async () => {
    const { client, http } = fixture();

    await client.enviarEventoConversionLead('dataset', 'tok', {
      nombreEvento: 'Won',
      fechaEvento: new Date('2026-10-21T12:00:00Z'),
      eventoId: 'hist-1',
      leadIdMeta: '1234567890123456',
    });

    const evento = (
      http.post.mock.calls[0][1] as { data: Record<string, unknown>[] }
    ).data[0];
    expect(evento).toMatchObject({
      event_name: 'Won',
      action_source: 'system_generated',
      user_data: { lead_id: '1234567890123456' },
      custom_data: { event_source: 'crm', lead_event_source: 'SAAS CRM' },
    });
    expect(evento).not.toHaveProperty('lead_event_source');
  });
});
