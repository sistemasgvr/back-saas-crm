import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { construirResultadoPaginado } from '../../shared/application/paginacion';
import type { RolOrganizacion } from '../../auth/domain/request-context.interface';
import type {
  CrearUsuarioInput,
  FiltroListadoUsuarios,
  UsuarioConMembresias,
  UsuariosAdminRepository,
} from '../application/ports/usuarios-admin.repository.port';

@Injectable()
export class PrismaUsuariosAdminRepository implements UsuariosAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtro: FiltroListadoUsuarios) {
    const q = filtro.q?.trim();
    const where: Prisma.UsuarioWhereInput = {
      ...(filtro.estado !== undefined ? { estado: filtro.estado } : {}),
      ...(filtro.esAdminPlataforma !== undefined ? { esAdminPlataforma: filtro.esAdminPlataforma } : {}),
      ...(q
        ? {
            OR: [
              { nombre: { contains: q, mode: 'insensitive' } },
              { apellido: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { telefono: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, usuarios] = await Promise.all([
      this.prisma.usuario.count({ where }),
      this.prisma.usuario.findMany({
        where,
        orderBy: { fechaCreacion: 'desc' },
        skip: (filtro.page - 1) * filtro.pageSize,
        take: filtro.pageSize,
      }),
    ]);
    return construirResultadoPaginado(usuarios, total, filtro.page, filtro.pageSize);
  }

  async obtenerPorId(id: string): Promise<UsuarioConMembresias | null> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      include: { organizacionUsuarios: { include: { organizacion: true } } },
    });
    if (!usuario) return null;

    const { organizacionUsuarios, ...resto } = usuario;
    return {
      ...resto,
      organizacionUsuarios: organizacionUsuarios.map((membresia) => ({
        organizacionId: membresia.organizacionId,
        organizacionNombre: membresia.organizacion.nombre,
        rol: membresia.rol as RolOrganizacion,
        estado: membresia.estado,
      })),
    };
  }

  buscarActivoPorEmail(email: string) {
    return this.prisma.usuario.findFirst({ where: { email, estado: 1 } });
  }

  crear(input: CrearUsuarioInput, passwordHash: string, usuarioCreacion: string) {
    return this.prisma.usuario.create({
      data: {
        email: input.email,
        nombre: input.nombre,
        apellido: input.apellido,
        telefono: input.telefono,
        esAdminPlataforma: input.esAdminPlataforma ? 1 : 0,
        passwordHash,
        usuarioCreacion,
      },
    });
  }

  cambiarEstado(id: string, estado: 0 | 1, usuarioEdicion: string) {
    return this.prisma.usuario.update({ where: { id }, data: { estado, usuarioEdicion } });
  }

  async asignarAOrganizacion(
    usuarioId: string,
    organizacionId: string,
    rol: RolOrganizacion,
    usuarioEdicion: string,
  ): Promise<void> {
    await this.prisma.organizacionUsuario.upsert({
      where: { organizacionId_usuarioId: { organizacionId, usuarioId } },
      update: { rol, estado: 1, usuarioEdicion },
      create: { organizacionId, usuarioId, rol, usuarioCreacion: usuarioEdicion },
    });
  }
}
