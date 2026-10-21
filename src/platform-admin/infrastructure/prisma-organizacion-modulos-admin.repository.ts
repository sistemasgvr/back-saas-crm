import { lockBotOrganizacion } from '../../whatsapp/messaging/application/bot-organizacion-lock';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import {
  dependenciasDe,
  dependientesActivos,
} from '../../shared/domain/modulos-dependencias';
import type {
  GrupoMatriz,
  OrganizacionModulosAdminRepository,
} from '../application/ports/organizacion-modulos-admin.repository.port';

@Injectable()
export class PrismaOrganizacionModulosAdminRepository implements OrganizacionModulosAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listarMatrizPorOrganizacion(
    organizacionId: string,
  ): Promise<GrupoMatriz[]> {
    const [grupos, relaciones] = await Promise.all([
      this.prisma.moduloGrupo.findMany({
        where: { estado: 1 },
        orderBy: [{ orden: 'asc' }, { codigo: 'asc' }],
        include: {
          modulos: {
            where: { estado: 1 },
            orderBy: [{ orden: 'asc' }, { codigo: 'asc' }],
          },
        },
      }),
      this.prisma.organizacionModulo.findMany({
        where: { organizacionId, estado: 1 },
      }),
    ]);
    return grupos.map(({ modulos, ...grupo }) => {
      const filas = modulos.map((m) => ({
        ...m,
        habilitado: relaciones.some(
          (r) => r.moduloId === m.id && r.habilitado === 1,
        ),
      }));
      const activos = filas.filter((m) => m.habilitado).length;
      return {
        grupo,
        habilitado:
          activos === 0
            ? 'ninguno'
            : activos === filas.length
              ? 'todos'
              : 'parcial',
        modulos: filas,
      };
    });
  }

  async toggle(
    organizacionId: string,
    moduloId: string,
    habilitado: boolean,
    usuarioEdicion: string,
    desactivarDependientes = false,
  ): Promise<void> {
    await this.cambiar(
      organizacionId,
      { moduloId },
      habilitado,
      usuarioEdicion,
      desactivarDependientes,
    );
  }

  async toggleGrupo(
    organizacionId: string,
    grupoId: string,
    habilitado: boolean,
    usuarioEdicion: string,
    desactivarDependientes = false,
  ): Promise<void> {
    await this.cambiar(
      organizacionId,
      { grupoId },
      habilitado,
      usuarioEdicion,
      desactivarDependientes,
    );
  }

  private async cambiar(
    organizacionId: string,
    selector: { moduloId?: string; grupoId?: string },
    habilitado: boolean,
    usuarioEdicion: string,
    cascada: boolean,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(746321)`;
      await lockBotOrganizacion(tx, organizacionId);
      if (
        !(await tx.organizacion.findUnique({ where: { id: organizacionId } }))
      )
        throw new NotFoundException('Organización no encontrada');
      if (
        selector.grupoId &&
        !(await tx.moduloGrupo.findUnique({ where: { id: selector.grupoId } }))
      )
        throw new NotFoundException('Grupo no encontrado');
      if (
        habilitado &&
        selector.grupoId &&
        !(await tx.moduloGrupo.findFirst({
          where: { id: selector.grupoId, estado: 1 },
        }))
      )
        throw new ConflictException('El grupo está retirado del catálogo');
      const catalogo = await tx.modulo.findMany({ include: { grupo: true } });
      const seleccion = catalogo.filter((m) =>
        selector.moduloId
          ? m.id === selector.moduloId
          : m.grupoId === selector.grupoId && (!habilitado || m.estado === 1),
      );
      if (selector.moduloId && !seleccion.length)
        throw new NotFoundException('Módulo no encontrado');
      const relaciones = await tx.organizacionModulo.findMany({
        where: { organizacionId },
      });
      const habilitados = catalogo
        .filter(
          (m) =>
            m.estado === 1 &&
            m.grupo?.estado === 1 &&
            relaciones.some(
              (r) =>
                r.moduloId === m.id && r.estado === 1 && r.habilitado === 1,
            ),
        )
        .map((m) => m.codigo);
      const codigos = new Set(seleccion.map((m) => m.codigo));
      if (habilitado) {
        for (const m of seleccion)
          for (const codigo of dependenciasDe(m.codigo, catalogo))
            codigos.add(codigo);
        const retirados = catalogo.filter(
          (m) =>
            codigos.has(m.codigo) && (m.estado !== 1 || m.grupo?.estado !== 1),
        );
        if (retirados.length)
          throw new ConflictException({
            message: 'Hay módulos o grupos retirados del catálogo',
            modulos: retirados.map((m) => m.codigo),
          });
      } else {
        const dependientes = new Set<string>();
        for (const m of seleccion)
          for (const c of dependientesActivos(m.codigo, habilitados, catalogo))
            if (!codigos.has(c)) dependientes.add(c);
        if (dependientes.size && !cascada)
          throw new ConflictException({
            message: 'Desactiva también los módulos dependientes',
            dependientes: [...dependientes],
          });
        for (const c of dependientes) codigos.add(c);
      }
      let cambiaBot = false;
      for (const m of catalogo.filter((m) => codigos.has(m.codigo))) {
        const existente = relaciones.find((r) => r.moduloId === m.id);
        const cambio =
          !existente ||
          existente.habilitado !== (habilitado ? 1 : 0) ||
          existente.estado !== 1;
        if (cambio && ['WHATSAPP', 'AUTOMATIZACIONES'].includes(m.codigo))
          cambiaBot = true;
        await this.guardar(
          tx,
          organizacionId,
          m.id,
          habilitado,
          usuarioEdicion,
          existente?.fechaActivacion ?? null,
          existente?.habilitado === 1,
        );
      }
      if (cambiaBot)
        await tx.whatsappBotConfiguracion.updateMany({
          where: { organizacionId },
          data: { version: { increment: 1 } },
        });
    });
  }

  private guardar(
    tx: Prisma.TransactionClient,
    organizacionId: string,
    moduloId: string,
    habilitado: boolean,
    usuarioEdicion: string,
    fecha: Date | null,
    estabaActivo: boolean,
  ) {
    return tx.organizacionModulo.upsert({
      where: { organizacionId_moduloId: { organizacionId, moduloId } },
      create: {
        organizacionId,
        moduloId,
        habilitado: habilitado ? 1 : 0,
        fechaActivacion: habilitado ? new Date() : null,
        usuarioCreacion: usuarioEdicion,
      },
      update: {
        estado: 1,
        habilitado: habilitado ? 1 : 0,
        usuarioEdicion,
        fechaActivacion: habilitado && !estabaActivo ? new Date() : fecha,
      },
    });
  }
}
