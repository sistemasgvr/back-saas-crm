import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';
import type { RolOrganizacion } from '../../../../auth/domain/request-context.interface';

const ROLES_ADMIN: RolOrganizacion[] = ['PROPIETARIO', 'ADMINISTRADOR'];

/** Meta pide E.164 con '+' en block_users; nosotros guardamos wa_id sin '+'. */
function telefonoParaBloqueo(waId: string): string {
  const digitos = waId.replace(/\D/g, '');
  return `+${digitos}`;
}

@Injectable()
export class BloquearContactoWhatsAppUseCase {
  constructor(
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly conexionesWa: WhatsappConexionesRepository,
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(
    organizacionId: string,
    conversacionId: string,
    bloquear: boolean,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ): Promise<void> {
    const conversacion = await this.conversaciones.findPorId(
      organizacionId,
      conversacionId,
    );
    if (!conversacion) {
      throw new NotFoundException('Conversación no encontrada');
    }

    const esAdmin = ROLES_ADMIN.includes(ctx.rol);
    const esDueno = conversacion.lead?.asignadoUsuarioId === ctx.usuarioId;
    if (!esAdmin && !esDueno) {
      throw new ForbiddenException(
        'Solo el dueño del lead o un administrador puede bloquear este contacto',
      );
    }

    const whatsappConexion =
      await this.conexionesWa.listarPorOrganizacion(organizacionId);
    const conexionActiva = whatsappConexion[0];
    if (!conexionActiva) {
      throw new NotFoundException(
        'No hay un número de WhatsApp vinculado a esta organización',
      );
    }

    const conexion =
      await this.conexiones.findActivaPorOrganizacion(organizacionId);
    if (!conexion?.tokenCifrado) {
      throw new NotFoundException(
        'No hay una sesión de Meta conectada para esta organización',
      );
    }
    const accessToken = this.tokenEncryption.decrypt(conexion.tokenCifrado);
    const telefono = telefonoParaBloqueo(conversacion.waId);

    if (bloquear) {
      await this.graph.bloquearUsuariosWhatsApp(
        conexionActiva.phoneNumberId,
        accessToken,
        [telefono],
      );
    } else {
      await this.graph.desbloquearUsuariosWhatsApp(
        conexionActiva.phoneNumberId,
        accessToken,
        [telefono],
      );
    }

    await this.conversaciones.marcarBloqueado(conversacionId, bloquear);
  }
}
