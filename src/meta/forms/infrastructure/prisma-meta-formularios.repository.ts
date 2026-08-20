import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import type {
  MetaFormulariosRepository,
  MetaFormularioRow,
  UpsertFormularioInput,
} from '../application/ports/meta-formularios.repository.port';

function toRow(formulario: {
  id: string;
  organizacionId: string;
  metaPaginaId: string;
  formId: string;
  nombre: string;
  estadoMeta: string | null;
  locale: string | null;
  ultimoSyncEn: Date | null;
  fechaCreacion: Date;
}): MetaFormularioRow {
  return { ...formulario };
}

@Injectable()
export class PrismaMetaFormulariosRepository implements MetaFormulariosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listarPorPagina(organizacionId: string, metaPaginaId: string) {
    const formularios = await this.prisma.metaFormulario.findMany({
      where: {
        organizacionId,
        metaPaginaId,
        estado: 1,
        metaPagina: { estado: 1 },
      },
      orderBy: { nombre: 'asc' },
    });
    return formularios.map(toRow);
  }

  async listarActivosFiltro(organizacionId: string, metaPaginaId?: string) {
    const formularios = await this.prisma.metaFormulario.findMany({
      where: {
        organizacionId,
        estado: 1,
        metaPagina: { estado: 1 },
        ...(metaPaginaId ? { metaPaginaId } : {}),
      },
      select: { formId: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
    return formularios.map((f) => ({ id: f.formId, nombre: f.nombre }));
  }

  async upsertVinculado(
    input: UpsertFormularioInput,
  ): Promise<MetaFormularioRow> {
    const existente = await this.prisma.metaFormulario.findFirst({
      where: { organizacionId: input.organizacionId, formId: input.formId },
    });

    const datos = {
      nombre: input.nombre,
      estadoMeta: input.estadoMeta ?? null,
      locale: input.locale ?? null,
      ultimoSyncEn: new Date(),
      estado: 1,
      usuarioEdicion: input.usuarioEdicion,
    };

    const formulario = existente
      ? await this.prisma.metaFormulario.update({
          where: { id: existente.id },
          data: datos,
        })
      : await this.prisma.metaFormulario.create({
          data: {
            organizacionId: input.organizacionId,
            metaPaginaId: input.metaPaginaId,
            formId: input.formId,
            ...datos,
            usuarioCreacion: input.usuarioEdicion,
          },
        });

    return toRow(formulario);
  }
}
