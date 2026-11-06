import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service';

export type TipoOrigen = 'paginas' | 'campanas' | 'formularios';

@Injectable()
export class LeadSourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(organizacionId: string) {
    const args = {
      where: { organizacionId, estado: 1 },
      select: { id: true, importarLeadsAutomaticamente: true },
    };
    const [paginas, campanas, formularios] = await Promise.all([
      this.prisma.metaPagina.findMany(args),
      this.prisma.campana.findMany(args),
      this.prisma.metaFormulario.findMany(args),
    ]);
    return { paginas, campanas, formularios };
  }

  async actualizar(
    organizacionId: string,
    tipo: TipoOrigen,
    id: string,
    habilitado: boolean,
    usuarioEdicion: string,
  ) {
    const args = {
      where: { id, organizacionId, estado: 1 },
      data: { importarLeadsAutomaticamente: habilitado, usuarioEdicion },
    };
    const resultado =
      tipo === 'paginas'
        ? await this.prisma.metaPagina.updateMany(args)
        : tipo === 'campanas'
          ? await this.prisma.campana.updateMany(args)
          : await this.prisma.metaFormulario.updateMany(args);
    if (!resultado.count) throw new NotFoundException('Origen no encontrado');
    return { importarLeadsAutomaticamente: habilitado };
  }

  async permitePagina(organizacionId: string, id: string): Promise<boolean> {
    const pagina = await this.prisma.metaPagina.findFirst({
      where: { id, organizacionId, estado: 1 },
      select: { importarLeadsAutomaticamente: true },
    });
    return pagina?.importarLeadsAutomaticamente === true;
  }

  async permiteLead(
    organizacionId: string,
    metaPaginaId: string,
    lead: { campaignId?: string; formId?: string },
  ): Promise<boolean> {
    const [pagina, campana, formulario] = await Promise.all([
      this.permitePagina(organizacionId, metaPaginaId),
      lead.campaignId
        ? this.prisma.campana.findFirst({
            where: { organizacionId, metaCampanaId: lead.campaignId },
            select: { importarLeadsAutomaticamente: true, estado: true },
          })
        : null,
      lead.formId
        ? this.prisma.metaFormulario.findFirst({
            where: {
              organizacionId,
              metaPaginaId,
              formId: lead.formId,
              estado: 1,
            },
            select: { importarLeadsAutomaticamente: true },
          })
        : null,
    ]);
    // Los orígenes todavía no sincronizados conservan la recepción existente.
    return (
      pagina &&
      (!campana ||
        (campana.estado === 1 && campana.importarLeadsAutomaticamente)) &&
      formulario?.importarLeadsAutomaticamente !== false
    );
  }
}
