import type { Readable } from 'stream';
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OBJECT_STORAGE } from '../../../../shared/application/ports/object-storage.port';
import type { ObjectStorage } from '../../../../shared/application/ports/object-storage.port';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';
import type { RolOrganizacion } from '../../../../auth/domain/request-context.interface';
import { puedeVerConversacionWhatsApp } from '../../domain/acceso-conversacion-whatsapp';

export interface MediaMensajeStream {
  stream: Readable;
  mimeType: string;
  nombreArchivo: string | null;
  tamanoBytes: number | null;
}

/** Sirve el archivo de un mensaje desde MinIO — mismo control de acceso que
 * abrir la conversación (lectura para cualquier miembro de la org). */
@Injectable()
export class ObtenerMediaMensajeUseCase {
  constructor(
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async execute(
    organizacionId: string,
    conversacionId: string,
    mensajeId: string,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ): Promise<MediaMensajeStream> {
    const conversacion = await this.conversaciones.findPorId(
      organizacionId,
      conversacionId,
    );
    if (!conversacion) {
      throw new NotFoundException('Conversación no encontrada');
    }

    if (!puedeVerConversacionWhatsApp(conversacion.lead, ctx)) {
      throw new ForbiddenException('No tienes acceso a esta conversación');
    }

    const media = await this.conversaciones.obtenerMedia(
      organizacionId,
      mensajeId,
    );
    if (!media) {
      throw new NotFoundException(
        'El mensaje no existe o no tiene un archivo asociado',
      );
    }

    const stream = await this.storage.getStream(media.objectKey);
    return {
      stream,
      mimeType: media.mimeType,
      nombreArchivo: media.nombreArchivo,
      tamanoBytes: media.tamanoBytes,
    };
  }
}
