import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { logoOrganizacionUrl } from '../../../shared/domain/logo-organizacion';
import type {
  RequestContext,
  RolOrganizacion,
} from '../../domain/request-context.interface';
import { USUARIOS_REPOSITORY } from '../ports/usuarios.repository.port';
import type { UsuariosRepository } from '../ports/usuarios.repository.port';
import { ORGANIZACION_USUARIOS_REPOSITORY } from '../ports/organizacion-usuarios.repository.port';
import type { OrganizacionUsuariosRepository } from '../ports/organizacion-usuarios.repository.port';
import { MODULOS_REPOSITORY } from '../ports/modulos.repository.port';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import { resolverPermisosEfectivos } from '../../../shared/infrastructure/permisos-efectivos';
import type {
  ModulosRepository,
  ModuloOrganizacion,
} from '../ports/modulos.repository.port';

@Injectable()
export class MeUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORY) private readonly usuarios: UsuariosRepository,
    @Inject(ORGANIZACION_USUARIOS_REPOSITORY)
    private readonly membresias: OrganizacionUsuariosRepository,
    @Inject(MODULOS_REPOSITORY) private readonly modulos: ModulosRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(context: RequestContext) {
    const usuario = await this.usuarios.findActivoById(context.usuarioId);
    if (!usuario) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    let organizacion: {
      id: string;
      nombre: string;
      slug: string;
      logoUrl: string | null;
    } | null = null;
    let rol: RolOrganizacion | null = null;
    let modulosOrg: ModuloOrganizacion[] = [];
    let rolNombre: string | null = null;
    let permisos: string[] = [];

    if (context.organizacionId) {
      const membresia = await this.membresias.findMembresiaActiva(
        usuario.id,
        context.organizacionId,
      );
      if (membresia) {
        organizacion = {
          id: membresia.organizacionId,
          nombre: membresia.organizacionNombre,
          slug: membresia.organizacionSlug,
          logoUrl: logoOrganizacionUrl(
            membresia.organizacionId,
            membresia.organizacionLogoUrl,
          ),
        };
        rol = membresia.rol;
        modulosOrg = await this.modulos.findModulosPorOrganizacion(
          membresia.organizacionId,
        );
        const efectivos = await resolverPermisosEfectivos(
          this.prisma,
          membresia.organizacionId,
          usuario.id,
        );
        rolNombre = efectivos?.rolNombre ?? null;
        permisos = efectivos?.permisos ?? [];
      }
    }

    return {
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        debeCambiarPassword: usuario.debeCambiarPassword === 1,
        apellido: usuario.apellido,
        telefono: usuario.telefono,
        esAdminPlataforma: usuario.esAdminPlataforma === 1,
      },
      organizacion,
      rol,
      rolNombre,
      /** Permisos efectivos (rol ∩ módulos activos): el front decide con ellos. */
      permisos,
      modulos: modulosOrg,
    };
  }
}
