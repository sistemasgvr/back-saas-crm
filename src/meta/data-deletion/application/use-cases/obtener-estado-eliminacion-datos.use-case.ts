import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  META_ELIMINACION_DATOS_REPOSITORY,
  type MetaEliminacionDatosRepository,
} from '../ports/meta-eliminacion-datos.repository.port';

@Injectable()
export class ObtenerEstadoEliminacionDatosUseCase {
  constructor(
    @Inject(META_ELIMINACION_DATOS_REPOSITORY)
    private readonly solicitudes: MetaEliminacionDatosRepository,
  ) {}

  async execute(confirmationCode: string) {
    const row = await this.solicitudes.findPorConfirmationCode(
      confirmationCode.trim(),
    );
    if (!row) {
      throw new NotFoundException('Solicitud de eliminación no encontrada');
    }

    return {
      confirmationCode: row.confirmationCode,
      estado: row.estado,
      tipo: row.tipo,
      detalle: row.detalle,
      fechaCreacion: row.fechaCreacion,
      fechaProcesada: row.fechaProcesada,
    };
  }
}
