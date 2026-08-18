import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { construirResultadoPaginado } from '../../shared/application/paginacion';
import type { RolOrganizacion } from '../../auth/domain/request-context.interface';
import type {
  CrearUsuarioInput,
  UsuarioConMembresias,
  UsuariosAdminRepository,
} from '../application/ports/usuarios-admin.repository.port';

@Injectable()
export class PrismaUsuariosAdminRepository implements UsuariosAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(page: number, pageSize: number) {
    const where = { estado: 1 };
    const [total, usuarios] = await Promise.all([
      this.prisma.usuario.count({ where }),
      this.prisma.usuario.findMany({
        where,
        orderBy: { fechaCreacion: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return construirResultadoPaginado(usuarios, total, page, pageSize);
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
