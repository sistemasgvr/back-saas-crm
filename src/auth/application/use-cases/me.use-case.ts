import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { RequestContext, RolOrganizacion } from '../../domain/request-context.interface';
import { USUARIOS_REPOSITORY } from '../ports/usuarios.repository.port';
import type { UsuariosRepository } from '../ports/usuarios.repository.port';
import { ORGANIZACION_USUARIOS_REPOSITORY } from '../ports/organizacion-usuarios.repository.port';
import type { OrganizacionUsuariosRepository } from '../ports/organizacion-usuarios.repository.port';
import { MODULOS_REPOSITORY } from '../ports/modulos.repository.port';
import type { ModulosRepository, ModuloOrganizacion } from '../ports/modulos.repository.port';

@Injectable()
export class MeUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORY) private readonly usuarios: UsuariosRepository,
    @Inject(ORGANIZACION_USUARIOS_REPOSITORY)
    private readonly membresias: OrganizacionUsuariosRepository,
    @Inject(MODULOS_REPOSITORY) private readonly modulos: ModulosRepository,
  ) {}

  async execute(context: RequestContext) {
    const usuario = await this.usuarios.findActivoById(context.usuarioId);
    if (!usuario) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    let organizacion: { id: string; nombre: string; slug: string } | null = null;
    let rol: RolOrganizacion | null = null;
    let modulosOrg: ModuloOrganizacion[] = [];

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
        };
        rol = membresia.rol;
        modulosOrg = await this.modulos.findModulosPorOrganizacion(membresia.organizacionId);
      }
    }

    return {
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        esAdminPlataforma: usuario.esAdminPlataforma === 1,
      },
      organizacion,
      rol,
      modulos: modulosOrg,
    };
  }
}
