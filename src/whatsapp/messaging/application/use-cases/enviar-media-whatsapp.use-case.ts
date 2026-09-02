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
import { validarArchivoWhatsApp } from '../limites-media-whatsapp';

const ROLES_ADMIN: RolOrganizacion[] = ['PROPIETARIO', 'ADMINISTRADOR'];

export interface EnviarMediaInput {
  buffer: Buffer;
  mimeType: string;
  nombreArchivo?: string;
  caption?: string;
  /** Id PROPIO (no wamid) del mensaje al que este responde. */
  respondeAMensajeId?: string;
}

/** Envía un archivo (imagen/video/audio/documento/sticker) a un chat —
 * mismo flujo que texto: solo funciona DENTRO de la ventana de 24h, Meta no
 * admite archivos libres fuera de ella (solo plantillas). Sube el archivo a
 * Meta, lo manda, y guarda una copia propia en WhatsappMensajeMedia — el
 * media_id de Meta para lo que subimos nosotros dura 30 días, no sirve como
 * referencia permanente para mostrarlo después en el historial del chat. */
@Injectable()
export class EnviarMediaWhatsAppUseCase {
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
    input: EnviarMediaInput,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ): Promise<void> {
    const { categoria } = validarArchivoWhatsApp(
      input.mimeType,
      input.buffer.length,
    );

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
        'Solo el dueño del lead o un administrador puede escribir en este chat',
      );
    }

    const dentroDeVentana =
      conversacion.ventanaExpiraEn !== null &&
      conversacion.ventanaExpiraEn.getTime() > Date.now();
    if (!dentroDeVentana) {
      throw new BadRequestException(
        'Pasaron 24h desde el último mensaje del contacto — fuera de la ventana solo se pueden ' +
          'enviar plantillas aprobadas, no archivos libres',
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

    const subido = await this.graph.subirMediaWhatsApp(
      conexionActiva.phoneNumberId,
      accessToken,
      input.buffer,
      input.mimeType,
      input.nombreArchivo,
    );
    const resultado = await this.graph.enviarMediaWhatsApp(
      conexionActiva.phoneNumberId,
      accessToken,
      conversacion.waId,
      categoria,
      subido.mediaId,
      { caption: input.caption, filename: input.nombreArchivo, respondeAWamid },
    );

    await this.conversaciones.registrarMensaje({
      organizacionId,
      whatsappConversacionId: conversacionId,
      wamid: resultado.wamid,
      direccion: 'saliente',
      tipo: categoria,
      texto: input.caption,
      estadoEntrega: 'enviado',
      datosCrudos: {
        tipo: categoria,
        caption: input.caption,
        nombreArchivo: input.nombreArchivo,
      },
      mediaId: subido.mediaId,
      mediaMimeType: input.mimeType,
      mediaNombreArchivo: input.nombreArchivo,
      mediaCaption: input.caption,
      mediaTamanoBytes: input.buffer.length,
      mediaBytes: input.buffer,
      fechaMensaje: new Date(),
      usuarioCreacion: ctx.usuarioId,
      respondeAMensajeId: input.respondeAMensajeId,
    });
  }
}
