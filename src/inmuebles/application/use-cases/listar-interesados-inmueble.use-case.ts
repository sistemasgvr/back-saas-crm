import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { RequestContext } from '../../../auth/domain/request-context.interface';
import {
  INMUEBLES_REPOSITORY,
  type InmueblesRepository,
  type LeadCandidatoInteres,
} from '../ports/inmuebles.repository.port';
import {
  rankearInteresados,
  type InteresadoRankeado,
} from '../../domain/ranking-interesados';
import { tienePermiso } from '../../../shared/domain/permisos';

@Injectable()
export class ListarInteresadosInmuebleUseCase {
  constructor(
    @Inject(INMUEBLES_REPOSITORY)
    private readonly inmuebles: InmueblesRepository,
  ) {}

  async execute(
    ctx: RequestContext,
    inmuebleId: string,
  ): Promise<InteresadoRankeado[]> {
    const organizacionId = ctx.organizacionId!;
    const inmueble = await this.inmuebles.obtenerPorId(
      organizacionId,
      inmuebleId,
    );
    if (!inmueble) {
      throw new NotFoundException('Inmueble no encontrado');
    }

    const candidatos = await this.inmuebles.listarCandidatosInteres(
      organizacionId,
      inmuebleId,
    );

    const visibles = this.filtrarPorRol(candidatos, ctx);

    return rankearInteresados(visibles, inmueble.operacion);
  }

  /** USUARIO solo ve interesados suyos o del pool (sin asignar). */
  private filtrarPorRol(
    candidatos: LeadCandidatoInteres[],
    ctx: RequestContext,
  ): LeadCandidatoInteres[] {
    if (tienePermiso(ctx, 'leads.ver_todos')) {
      return candidatos;
    }
    return candidatos.filter(
      (c) =>
        c.asignadoUsuarioId === null || c.asignadoUsuarioId === ctx.usuarioId,
    );
  }
}
