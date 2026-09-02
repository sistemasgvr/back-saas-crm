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

/** PATCH .../messages/:mensajeId/reaction — reacciona (o saca la reacción,
 * con emoji vacío) a un mensaje ya enviado, mismo criterio de dueño/admin
 * que enviar un mensaje. No es un mensaje de chat nuevo: solo se manda a
 * Graph y se pega el emoji sobre la fila del mensaje objetivo. */
@Injectable()
export class EnviarReaccionWhatsAppUseCase {
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
    mensajeId: string,
    emoji: string,
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
        'Solo el dueño del lead o un administrador puede reaccionar en este chat',
      );
    }

    const mensaje = await this.conversaciones.buscarMensajePorId(
      organizacionId,
      mensajeId,
    );
    if (!mensaje || mensaje.whatsappConversacionId !== conversacionId) {
      throw new NotFoundException('El mensaje no existe en esta conversación');
    }

    const whatsappConexion =
      await this.conexionesWa.listarPorOrganizacion(organizacionId);
    // Solo hay 1 número por org en v1 — mismo supuesto que enviar mensajes.
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

    await this.graph.enviarReaccionWhatsApp(
      conexionActiva.phoneNumberId,
      accessToken,
      conversacion.waId,
      mensaje.wamid,
      emoji,
    );

    await this.conversaciones.actualizarReaccionAgente(
      organizacionId,
      mensajeId,
      emoji || null,
    );
  }
}
