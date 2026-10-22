import { Logger } from '@nestjs/common';
import { ProcesarEventoCuentaWhatsAppUseCase } from './procesar-evento-cuenta-whatsapp.use-case';
import type { WhatsappConexionesRepository } from '../../../../whatsapp/connections/application/ports/whatsapp-conexiones.repository.port';
import type { CrearNotificacionUseCase } from '../../../../notifications/application/use-cases/crear-notificacion.use-case';
import type { EventoCuentaWhatsApp } from '../../domain/whatsapp-webhook-cuenta';

const linea = (id: string, organizacionId: string, numeroDisplay: string) => ({
  id,
  organizacionId,
  numeroDisplay,
});

function fixture(lineas = [linea('l1', 'org-1', '+51 987 654 321')]) {
  const conexiones = {
    findPorPhoneNumberId: jest.fn().mockResolvedValue(null),
    listarPorWabaId: jest.fn().mockResolvedValue(lineas),
    actualizarDatosMeta: jest.fn().mockResolvedValue(undefined),
  };
  const notificar = { execute: jest.fn().mockResolvedValue({ id: 'n1' }) };
  const useCase = new ProcesarEventoCuentaWhatsAppUseCase(
    conexiones as unknown as WhatsappConexionesRepository,
    notificar as unknown as CrearNotificacionUseCase,
  );
  return { useCase, conexiones, notificar };
}

const base: EventoCuentaWhatsApp = {
  campo: 'account_update',
  wabaId: 'waba-1',
  phoneNumberId: null,
  numeroDisplay: null,
  evento: 'ACCOUNT_OFFBOARDED',
  severidad: 'critica',
  titulo: 'WhatsApp: coexistencia desconectada',
  mensaje: 'Meta desvinculó la cuenta.',
  notificar: true,
  cambiosLinea: { estadoNumero: 'DISCONNECTED' },
};

describe('Eventos de cuenta WhatsApp', () => {
  beforeEach(() =>
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
  );
  afterEach(() => jest.restoreAllMocks());

  it('coexistencia desconectada: marca la línea y avisa solo a administradores', async () => {
    const { useCase, conexiones, notificar } = fixture();
    await useCase.execute(base);

    expect(conexiones.actualizarDatosMeta).toHaveBeenCalledWith('l1', {
      estadoNumero: 'DISCONNECTED',
    });
    expect(notificar.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        organizacionId: 'org-1',
        tipo: 'WHATSAPP_CUENTA',
        roles: ['PROPIETARIO', 'ADMINISTRADOR'],
        payload: expect.objectContaining({
          url: '/settings/whatsapp',
          severidad: 'critica',
        }) as unknown,
      }),
    );
  });

  it('con número visible solo afecta la línea de ese número', async () => {
    const { useCase, conexiones } = fixture([
      linea('l1', 'org-1', '+51 987 654 321'),
      linea('l2', 'org-1', '+51 911 111 111'),
    ]);
    await useCase.execute({ ...base, numeroDisplay: '51911111111' });
    expect(conexiones.actualizarDatosMeta).toHaveBeenCalledTimes(1);
    expect(conexiones.actualizarDatosMeta).toHaveBeenCalledWith('l2', {
      estadoNumero: 'DISCONNECTED',
    });
  });

  it('un número no vinculado al CRM no toca otras líneas del WABA', async () => {
    const { useCase, conexiones, notificar } = fixture();
    await useCase.execute({ ...base, numeroDisplay: '15550000000' });
    await useCase.execute({ ...base, phoneNumberId: 'phone-ajeno' });
    expect(conexiones.actualizarDatosMeta).not.toHaveBeenCalled();
    expect(notificar.execute).not.toHaveBeenCalled();
  });

  it('un WABA vinculado en dos orgs avisa una vez a cada una', async () => {
    const { useCase, notificar } = fixture([
      linea('l1', 'org-1', '+51 987 654 321'),
      linea('l2', 'org-1', '+51 911 111 111'),
      linea('l3', 'org-2', '+51 922 222 222'),
    ]);
    await useCase.execute({ ...base, cambiosLinea: undefined });
    expect(notificar.execute).toHaveBeenCalledTimes(2);
  });

  it('eventos informativos solo actualizan, sin notificar', async () => {
    const { useCase, notificar } = fixture();
    await useCase.execute({ ...base, notificar: false });
    expect(notificar.execute).not.toHaveBeenCalled();
  });
});
