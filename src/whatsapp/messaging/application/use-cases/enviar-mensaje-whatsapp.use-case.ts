import { ControlAtencionService } from '../control-atencion.service';
import {
  BadRequestException,
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
import type { ParametroPlantilla } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import { puedeEscribirConversacionWhatsApp } from '../../domain/acceso-conversacion-whatsapp';
import { idParaEnvioWhatsApp } from '../../domain/identidad-contacto-whatsapp';

export interface EnviarMensajeInput {
  texto?: string;
  plantillaNombre?: string;
  plantillaIdioma?: string;
  /** Nombre + valor por cada variable de la plantilla, en el orden en que
   * aparecen — el front ya los conoce porque los pidió al usuario con el
   * nombre real de cada {{variable}}. */
  parametros?: ParametroPlantilla[];
  /** 'NAMED' | 'POSITIONAL' de la plantilla elegida — el front lo trae de
   * GET /whatsapp/chats/templates, así no hace falta una vuelta extra a
   * Graph API solo para saber cómo armar el envío. */
  plantillaFormatoParametros?: string;
  /** Id PROPIO (no wamid) del mensaje al que este responde — "Responder" del
   * chat, como citar un mensaje en WhatsApp. Solo aplica al camino de texto
   * de sesión; Meta no soporta cita al responder con plantilla. */
  respondeAMensajeId?: string;
}

@Injectable()
export class EnviarMensajeWhatsAppUseCase {
  constructor(
    private readonly control: ControlAtencionService,
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
    input: EnviarMensajeInput,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ) {
    const conversacion = await this.conversaciones.findPorId(
      organizacionId,
      conversacionId,
    );
    if (!conversacion) {
      throw new NotFoundException('Conversación no encontrada');
    }

    if (!puedeEscribirConversacionWhatsApp(conversacion.lead, ctx)) {
      throw new ForbiddenException(
        'Solo el dueño del lead, un administrador o un chat libre pueden escribir aquí',
      );
    }

    const conexionActiva = await this.conexionesWa.findPorId(
      organizacionId,
      conversacion.whatsappConexionId,
    );
    if (!conexionActiva) {
      throw new NotFoundException(
        'No hay un número de WhatsApp vinculado a esta organización',
      );
    }

    const conexion = await this.conexiones.findActivaPorId(
      organizacionId,
      conexionActiva.metaConexionId,
    );
    if (
      !conexion?.tokenCifrado ||
      conexion.id !== conexionActiva.metaConexionId
    ) {
      throw new NotFoundException(
        'No hay una sesión de Meta conectada para esta organización',
      );
    }
    const accessToken = this.tokenEncryption.decrypt(conexion.tokenCifrado);

    const para = idParaEnvioWhatsApp(conversacion);
    if (!para) {
      throw new BadRequestException(
        'Esta conversación no tiene teléfono ni BSUID para enviar mensajes',
      );
    }

    const dentroDeVentana =
      conversacion.ventanaExpiraEn !== null &&
      conversacion.ventanaExpiraEn.getTime() > Date.now();

    let resultado: { wamid: string };
    let tipo: string;

    if (dentroDeVentana) {
      if (!input.texto) {
        throw new BadRequestException('Falta el texto del mensaje de sesión');
      }

      let respondeAWamid: string | undefined;
      if (input.respondeAMensajeId) {
        const citado = await this.conversaciones.buscarMensajePorId(
          organizacionId,
          input.respondeAMensajeId,
        );
        if (!citado || citado.whatsappConversacionId !== conversacionId) {
          throw new NotFoundException(
            'El mensaje citado no existe en esta conversación',
          );
        }
        respondeAWamid = citado.wamid;
      }

      resultado = await this.control.despachar(
        organizacionId,
        conversacionId,
        { tipo: 'HUMAN', ...ctx },
        'enviarMensajeTextoWhatsApp',
        () =>
          this.graph.enviarMensajeTextoWhatsApp(
            conexionActiva.phoneNumberId,
            accessToken,
            para,
            input.texto!,
            respondeAWamid,
          ),
      );
      tipo = 'text';
    } else {
      if (!input.plantillaNombre || !input.plantillaIdioma) {
        throw new BadRequestException(
          'La ventana de 24h expiró — hace falta enviar una plantilla aprobada (nombre + idioma)',
        );
      }
      resultado = await this.control.despachar(
        organizacionId,
        conversacionId,
        { tipo: 'HUMAN', ...ctx },
        'enviarMensajePlantillaWhatsApp',
        () =>
          this.graph.enviarMensajePlantillaWhatsApp(
            conexionActiva.phoneNumberId,
            accessToken,
            para,
            input.plantillaNombre!,
            input.plantillaIdioma!,
            input.parametros,
            input.plantillaFormatoParametros,
          ),
      );
      tipo = 'template';
    }

    await this.conversaciones.registrarMensaje({
      organizacionId,
      whatsappConversacionId: conversacionId,
      wamid: resultado.wamid,
      direccion: 'saliente',
      tipo,
      texto: input.texto,
      plantillaNombre: input.plantillaNombre,
      estadoEntrega: 'enviado',
      datosCrudos: {
        tipo,
        texto: input.texto,
        plantilla: input.plantillaNombre,
      },
      fechaMensaje: new Date(),
      usuarioCreacion: ctx.usuarioId,
      respondeAMensajeId: dentroDeVentana
        ? input.respondeAMensajeId
        : undefined,
    });
  }
}
