import { BadRequestException, Injectable } from '@nestjs/common';
import { dependenciasDe } from '../../shared/domain/modulos-dependencias';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import type {
  ActualizarModuloInput,
  CrearModuloInput,
  ModulosCatalogoRepository,
} from '../application/ports/modulos-catalogo.repository.port';

@Injectable()
export class PrismaModulosCatalogoRepository implements ModulosCatalogoRepository {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.modulo.findMany({
      include: { grupo: true },
      orderBy: [
        { grupo: { orden: 'asc' } },
        { orden: 'asc' },
        { codigo: 'asc' },
      ],
    });
  }

  obtenerPorId(id: string) {
    return this.prisma.modulo.findUnique({ where: { id } });
  }

  obtenerPorCodigo(codigo: string) {
    return this.prisma.modulo.findUnique({ where: { codigo } });
  }

  async crear(input: CrearModuloInput, usuarioCreacion: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(746321)`;
      await this.validar(tx, input.codigo, input.grupoId, input.requiere ?? []);
      return tx.modulo.create({ data: { ...input, usuarioCreacion } });
    });
  }

  async actualizar(
    id: string,
    input: ActualizarModuloInput,
    usuarioEdicion: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(746321)`;
      const actual = await tx.modulo.findUniqueOrThrow({ where: { id } });
      await this.validar(
        tx,
        actual.codigo,
        input.grupoId ?? actual.grupoId,
        input.requiere ?? actual.requiere,
      );
      return tx.modulo.update({
        where: { id },
        data: { ...input, usuarioEdicion },
      });
    });
  }

  private async validar(
    tx: import('@prisma/client').Prisma.TransactionClient,
    codigo: string,
    grupoId: string | null,
    requiere: string[],
  ) {
    if (
      !grupoId ||
      !(await tx.moduloGrupo.findFirst({ where: { id: grupoId, estado: 1 } }))
    ) {
      throw new BadRequestException('Selecciona un grupo vigente');
    }
    const catalogo = await tx.modulo.findMany();
    const propuesto = [
      ...catalogo.filter((m) => m.codigo !== codigo),
      { codigo, requiere },
    ];
    try {
      for (const m of propuesto) dependenciasDe(m.codigo, propuesto);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  cambiarEstado(id: string, estado: 0 | 1, usuarioEdicion: string) {
    return this.prisma.modulo.update({
      where: { id },
      data: { estado, usuarioEdicion },
    });
  }
}
