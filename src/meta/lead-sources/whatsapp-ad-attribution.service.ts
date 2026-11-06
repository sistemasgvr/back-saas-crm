import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service';

interface OrigenAnuncio {
  campanaId: string;
  conjuntoAnuncioId: string;
  anuncioId: string;
  habilitado: boolean;
}

function referencia(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || !('referral' in raw)) return null;
  const ref = raw.referral;
  if (
    !ref ||
    typeof ref !== 'object' ||
    !('source_type' in ref) ||
    ref.source_type !== 'ad' ||
    !('source_id' in ref)
  )
    return null;
  return typeof ref.source_id === 'string' && /^\d+$/.test(ref.source_id)
    ? ref.source_id
    : null;
}

@Injectable()
export class WhatsappAdAttributionService {
  constructor(private readonly prisma: PrismaService) {}

  async resolver(
    organizacionId: string,
    conversacionId: string,
    raw: unknown,
  ): Promise<OrigenAnuncio | null> {
    let sourceId = referencia(raw);
    if (!sourceId) {
      // El referral suele venir solo con el primer mensaje. Conserva su selección
      // para los mensajes siguientes de la misma conversación.
      const anterior = await this.prisma.whatsappMensaje.findFirst({
        where: {
          organizacionId,
          whatsappConversacionId: conversacionId,
          direccion: 'entrante',
          datosCrudos: { path: ['referral', 'source_type'], equals: 'ad' },
        },
        orderBy: [{ fechaMensaje: 'desc' }, { id: 'desc' }],
        select: { datosCrudos: true },
      });
      sourceId = referencia(anterior?.datosCrudos);
    }
    if (!sourceId) return null;
    const ad = await this.prisma.anuncio.findFirst({
      where: {
        organizacionId,
        metaAnuncioId: sourceId,
        estado: 1,
        conjuntoAnuncio: {
          organizacionId,
          estado: 1,
          campana: { organizacionId, estado: 1 },
        },
      },
      include: { conjuntoAnuncio: { include: { campana: true } } },
    });
    if (!ad) return null;
    return {
      anuncioId: ad.id,
      conjuntoAnuncioId: ad.conjuntoAnuncioId,
      campanaId: ad.conjuntoAnuncio.campanaId,
      habilitado: ad.conjuntoAnuncio.campana.importarLeadsAutomaticamente,
    };
  }

  async vincular(
    organizacionId: string,
    leadId: string,
    origen: OrigenAnuncio,
  ) {
    const { campanaId, conjuntoAnuncioId, anuncioId } = origen;
    const result = await this.prisma.lead.updateMany({
      where: {
        id: leadId,
        organizacionId,
        estado: 1,
        campanaId: null,
        conjuntoAnuncioId: null,
        anuncioId: null,
      },
      data: { campanaId, conjuntoAnuncioId, anuncioId },
    });
    return result.count;
  }

  async recuperar(organizacionId: string, cuentaId: string) {
    // Solo conversaciones ya vinculadas a un lead y anuncios de esta cuenta.
    // No crea contactos ni cambia selecciones manuales. Primer origen conocido.
    const mensajes = await this.prisma.whatsappMensaje.findMany({
      where: {
        organizacionId,
        direccion: 'entrante',
        datosCrudos: { path: ['referral', 'source_type'], equals: 'ad' },
        whatsappConversacion: {
          organizacionId,
          lead: { organizacionId, estado: 1, campanaId: null },
        },
      },
      orderBy: [{ fechaMensaje: 'asc' }, { id: 'asc' }],
      select: {
        datosCrudos: true,
        whatsappConversacionId: true,
        whatsappConversacion: { select: { leadId: true } },
      },
    });
    const campanas = new Set(
      (
        await this.prisma.campana.findMany({
          where: {
            organizacionId,
            metaCuentaPublicitariaId: cuentaId,
            estado: 1,
          },
          select: { id: true },
        })
      ).map((c) => c.id),
    );
    let vinculados = 0;
    const vistos = new Set<string>();
    for (const mensaje of mensajes) {
      const leadId = mensaje.whatsappConversacion.leadId;
      if (!leadId || vistos.has(leadId)) continue;
      const origen = await this.resolver(
        organizacionId,
        mensaje.whatsappConversacionId,
        mensaje.datosCrudos,
      );
      if (!origen || !campanas.has(origen.campanaId)) continue;
      vistos.add(leadId);
      vinculados += await this.vincular(organizacionId, leadId, origen);
    }
    return { vinculados };
  }
}
