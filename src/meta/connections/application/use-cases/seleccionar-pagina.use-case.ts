import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../ports/meta-conexiones.repository.port';
import { toConexionResponse } from '../conexion-response.mapper';

@Injectable()
export class SeleccionarPaginaUseCase {
  constructor(
    @Inject(META_CONEXIONES_REPOSITORY) private readonly conexiones: MetaConexionesRepository,
  ) {}

  async execute(
    organizacionId: string,
    pageId: string,
    pageNombre: string,
    usuarioEdicion: string,
  ) {
    const conexion = await this.conexiones.findActivaPorOrganizacion(organizacionId);
    if (!conexion) {
      throw new BadRequestException('No hay una conexión Meta activa. Conecta Meta primero.');
    }

    // Regla MVP: una página no puede pertenecer a dos empresas a la vez (PLAN.md §8.3).
    const enUso = await this.conexiones.findActivaPorPageId(pageId);
    if (enUso && enUso.organizacionId !== organizacionId) {
      throw new ConflictException('Esta página ya está conectada a otra organización');
    }

    const actualizada = await this.conexiones.actualizarPagina(
      conexion.id,
      pageId,
      pageNombre,
      usuarioEdicion,
    );
    return toConexionResponse(actualizada);
  }
}
