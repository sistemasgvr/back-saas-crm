import type { LeadsGestionRepository } from '../../../../leads/application/ports/leads-gestion.repository.port';
import { AutoAsignarLeadUseCase } from '../../../../leads/application/use-cases/auto-asignar-lead.use-case';
import type { LeadAutoAsignacionRepository } from '../../../../leads/application/ports/lead-auto-asignacion.repository.port';
import type { CrearNotificacionUseCase } from '../../../../notifications/application/use-cases/crear-notificacion.use-case';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';
import { AsegurarLeadParaConversacionWhatsAppUseCase } from './asegurar-lead-para-conversacion-whatsapp.use-case';

describe('Conservar asesor al recibir mensajes de WhatsApp', () => {
  const asignado = { id: 'lead-existente', asignadoUsuarioId: 'asesor-existente' };

  function escenario(lead: typeof asignado | null) {
    const conversaciones = {
      findPorId: jest.fn().mockResolvedValue({ lead, waId: null, bsuid: 'bsuid-qa' }),
      asignarLeadSiLibre: jest.fn().mockResolvedValue(true),
    };
    const leads = {
      buscarIdPorIdentidadWhatsApp: jest.fn().mockResolvedValue(asignado.id),
      crearDesdeWhatsApp: jest.fn(),
    };
    const reparto = {
      obtenerLeadParaAutoAsignacion: jest.fn().mockResolvedValue(asignado),
      encolarLead: jest.fn(),
      obtenerConfig: jest.fn(),
    };
    const notificaciones = { execute: jest.fn() };
    const caso = new AsegurarLeadParaConversacionWhatsAppUseCase(
      conversaciones as unknown as WhatsappConversacionesRepository,
      leads as unknown as LeadsGestionRepository,
      new AutoAsignarLeadUseCase(reparto as unknown as LeadAutoAsignacionRepository),
      notificaciones as unknown as CrearNotificacionUseCase,
    );
    return { caso, conversaciones, leads, reparto, notificaciones };
  }

  it('retorna al asesor actual cuando el contacto vuelve a escribir en el mismo chat', async () => {
    const { caso, conversaciones, leads, reparto } = escenario(asignado);
    expect(await caso.execute('org', 'chat')).toEqual({
      leadId: asignado.id,
      creado: false,
      fueAutoAsignado: false,
      asignadoUsuarioId: asignado.asignadoUsuarioId,
    });
    expect(leads.buscarIdPorIdentidadWhatsApp).not.toHaveBeenCalled();
    expect(conversaciones.asignarLeadSiLibre).not.toHaveBeenCalled();
    expect(reparto.obtenerLeadParaAutoAsignacion).not.toHaveBeenCalled();
  });

  it('reutiliza el lead con dueño para un chat nuevo que solo tiene BSUID', async () => {
    const { caso, conversaciones, leads, reparto, notificaciones } = escenario(null);
    expect(await caso.execute('org', 'chat-nuevo')).toEqual({
      leadId: asignado.id,
      creado: false,
      fueAutoAsignado: false,
      asignadoUsuarioId: asignado.asignadoUsuarioId,
    });
    expect(leads.buscarIdPorIdentidadWhatsApp).toHaveBeenCalledWith('org', 'chat-nuevo');
    expect(conversaciones.asignarLeadSiLibre).toHaveBeenCalledWith('org', 'chat-nuevo', asignado.id);
    expect(leads.crearDesdeWhatsApp).not.toHaveBeenCalled();
    expect(reparto.encolarLead).not.toHaveBeenCalled();
    expect(notificaciones.execute).not.toHaveBeenCalled();
  });

  it('respeta el vínculo que ganó una actualización concurrente', async () => {
    const { caso, conversaciones, reparto } = escenario(null);
    conversaciones.asignarLeadSiLibre.mockResolvedValue(false);
    conversaciones.findPorId.mockResolvedValueOnce({ lead: null }).mockResolvedValueOnce({
      lead: { id: 'otro-lead', asignadoUsuarioId: 'otro-asesor' },
    });
    expect(await caso.execute('org', 'chat-nuevo')).toEqual({
      leadId: 'otro-lead',
      creado: false,
      fueAutoAsignado: false,
      asignadoUsuarioId: 'otro-asesor',
    });
    expect(reparto.encolarLead).not.toHaveBeenCalled();
  });
});

