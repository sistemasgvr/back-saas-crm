import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ROL_LINEA_WHATSAPP,
  type RolLineaWhatsapp,
} from '../../domain/rol-linea-whatsapp';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../ports/whatsapp-conexiones.repository.port';

const ROLES_VALIDOS = new Set<string>(Object.values(ROL_LINEA_WHATSAPP));

@Injectable()
export class ActualizarRolLineaUseCase {
  constructor(
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly conexiones: WhatsappConexionesRepository,
  ) {}

  async execute(
    organizacionId: string,
    conexionId: string,
    rolLinea: string,
    usuarioEdicion: string,
  ) {
    if (!ROLES_VALIDOS.has(rolLinea)) {
      throw new BadRequestException(
        `rolLinea inválido. Use: ${[...ROLES_VALIDOS].join(', ')}`,
      );
    }

    const actualizada = await this.conexiones.actualizarRolLinea(
      organizacionId,
      conexionId,
      rolLinea as RolLineaWhatsapp,
      usuarioEdicion,
    );
    if (!actualizada) {
      throw new NotFoundException('Conexión de WhatsApp no encontrada');
    }
    return actualizada;
  }
}
