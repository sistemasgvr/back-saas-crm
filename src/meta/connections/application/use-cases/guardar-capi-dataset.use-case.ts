import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../ports/meta-conexiones.repository.port';

/** Guarda (o borra, con null) el dataset de Conversions API para Conversion
 * Leads — creado a mano por el usuario en Meta Events Manager, acá solo se
 * persiste el id (PLAN-PIPELINE-INMOBILIARIA.md §20.5). */
@Injectable()
export class GuardarCapiDatasetUseCase {
  constructor(
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
  ) {}

  async execute(
    organizacionId: string,
    capiDatasetId: string | null,
    usuarioId: string,
  ): Promise<void> {
    const conexion =
      await this.conexiones.findActivaPorOrganizacion(organizacionId);
    if (!conexion) {
      throw new NotFoundException(
        'No hay una sesión de Meta conectada para esta organización',
      );
    }
    await this.conexiones.actualizarCapiDatasetId(
      organizacionId,
      capiDatasetId,
      usuarioId,
    );
  }
}
