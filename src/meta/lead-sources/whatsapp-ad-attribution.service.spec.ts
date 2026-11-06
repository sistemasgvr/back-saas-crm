import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { WhatsappAdAttributionService } from './whatsapp-ad-attribution.service';

function fixture() {
  const ad = {
    id: 'ad',
    conjuntoAnuncioId: 'set',
    conjuntoAnuncio: {
      campanaId: 'campaign',
      campana: { importarLeadsAutomaticamente: true },
    },
  };
  const prisma = {
    anuncio: { findFirst: jest.fn().mockResolvedValue(ad) },
    whatsappMensaje: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(),
    },
    campana: { findMany: jest.fn().mockResolvedValue([{ id: 'campaign' }]) },
    lead: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  return {
    prisma,
    ad,
    service: new WhatsappAdAttributionService(
      prisma as unknown as PrismaService,
    ),
  };
}
const raw = { referral: { source_type: 'ad', source_id: '123456' } };

describe('Atribución de anuncios Click to WhatsApp', () => {
  it('resuelve el anuncio dentro de la organización y respeta la selección de campaña', async () => {
    const { service, prisma, ad } = fixture();
    ad.conjuntoAnuncio.campana.importarLeadsAutomaticamente = false;
    expect(await service.resolver('org', 'chat', raw)).toEqual({
      campanaId: 'campaign',
      conjuntoAnuncioId: 'set',
      anuncioId: 'ad',
      habilitado: false,
    });
    expect(prisma.anuncio.findFirst.mock.calls[0][0].where).toMatchObject({
      organizacionId: 'org',
      metaAnuncioId: '123456',
      conjuntoAnuncio: {
        organizacionId: 'org',
        campana: { organizacionId: 'org' },
      },
    });
  });

  it('recupera el origen previo cuando los mensajes siguientes ya no incluyen referral', async () => {
    const { service, prisma } = fixture();
    prisma.whatsappMensaje.findFirst.mockResolvedValue({ datosCrudos: raw });
    expect(await service.resolver('org', 'chat', {})).toMatchObject({
      campanaId: 'campaign',
    });
    expect(
      prisma.whatsappMensaje.findFirst.mock.calls[0][0].where,
    ).toMatchObject({
      organizacionId: 'org',
      whatsappConversacionId: 'chat',
      direccion: 'entrante',
    });
  });

  it('no atribuye mensajes sin referencia ni anuncios conocidos', async () => {
    const { service, prisma } = fixture();
    expect(await service.resolver('org', 'chat', {})).toBeNull();
    expect(prisma.anuncio.findFirst).not.toHaveBeenCalled();
    prisma.anuncio.findFirst.mockResolvedValue(null);
    expect(await service.resolver('org', 'chat', raw)).toBeNull();
  });

  it('vincula únicamente leads sin campaña, conjunto ni anuncio y nunca los crea', async () => {
    const { service, prisma } = fixture();
    const origen = (await service.resolver('org', 'chat', raw))!;
    await service.vincular('org', 'lead', origen);
    expect(prisma.lead.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'lead',
        organizacionId: 'org',
        estado: 1,
        campanaId: null,
        conjuntoAnuncioId: null,
        anuncioId: null,
      },
      data: {
        campanaId: 'campaign',
        conjuntoAnuncioId: 'set',
        anuncioId: 'ad',
      },
    });
  });

  it('recupera una sola vez cada lead y solo para campañas de la cuenta solicitada', async () => {
    const { service, prisma } = fixture();
    const mensaje = {
      datosCrudos: raw,
      whatsappConversacionId: 'chat',
      whatsappConversacion: { leadId: 'lead' },
    };
    prisma.whatsappMensaje.findMany.mockResolvedValue([mensaje, mensaje]);
    expect(await service.recuperar('org', 'cuenta')).toEqual({ vinculados: 1 });
    expect(prisma.lead.updateMany).toHaveBeenCalledTimes(1);
    prisma.campana.findMany.mockResolvedValue([{ id: 'otra' }]);
    expect(await service.recuperar('org', 'cuenta')).toEqual({ vinculados: 0 });
    expect(prisma.lead.updateMany).toHaveBeenCalledTimes(1);
  });
});
