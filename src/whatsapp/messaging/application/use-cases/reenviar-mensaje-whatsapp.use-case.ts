import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import type {
  MetaGraphClient,
  TipoMediaWhatsApp,
} from '../../../../meta/connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type {
  ContactoMensajeRow,
  WhatsappConversacionesRepository,
} from '../ports/whatsapp-conversaciones.repository.port';
import type { RolOrganizacion } from '../../../../auth/domain/request-context.interface';
import { categoriaMediaPorMimeType } from '../limites-media-whatsapp';

/** Tope alineado con el multi-forward de la app WhatsApp (~30). */
export const MAX_MENSAJES_REENVIAR = 30;

const ROLES_ADMIN: RolOrganizacion[] = ['PROPIETARIO', 'ADMINISTRADOR'];

const TIPOS_MEDIA = new Set([
  'image',
  'video',
  'audio',
  'document',
  'sticker',
]);

export type ReenviarLoteResultado = {
  enviados: number;
  fallidos: { mensajeId: string; error: string }[];
};

/**
 * Reenvía el contenido de uno o varios mensajes a otra conversación (la Cloud
 * API no tiene "forward" nativo: se vuelve a enviar el mismo payload).
 */
@Injectable()
export class ReenviarMensajeWhatsAppUseCase {
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
    conversacionOrigenId: string,
    mensajeId: string,
    conversacionDestinoId: string,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ): Promise<void> {
    const resultado = await this.executeLote(
      organizacionId,
      conversacionOrigenId,
      [mensajeId],
      conversacionDestinoId,
      ctx,
    );
    if (resultado.enviados !== 1) {
      throw new BadRequestException(
        resultado.fallidos[0]?.error ?? 'No se pudo reenviar el mensaje',
      );
    }
  }

  async executeLote(
    organizacionId: string,
    conversacionOrigenId: string,
    mensajeIds: string[],
    conversacionDestinoId: string,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ): Promise<ReenviarLoteResultado> {
    if (
      mensajeIds.length < 1 ||
      mensajeIds.length > MAX_MENSAJES_REENVIAR
    ) {
      throw new BadRequestException(
        `Puedes reenviar entre 1 y ${MAX_MENSAJES_REENVIAR} mensajes a la vez`,
      );
    }

    if (conversacionOrigenId === conversacionDestinoId) {
      throw new BadRequestException(
        'Elige otro chat para reenviar — no se puede reenviar al mismo',
      );
    }

    const origen = await this.conversaciones.findPorId(
      organizacionId,
      conversacionOrigenId,
    );
    const destino = await this.conversaciones.findPorId(
      organizacionId,
      conversacionDestinoId,
    );
    if (!origen || !destino) {
      throw new NotFoundException('Conversación no encontrada');
    }

    this.assertPuedeEscribir(destino, ctx);

    if (destino.bloqueado) {
      throw new BadRequestException(
        'Ese contacto está bloqueado — desbloquéalo antes de reenviar',
      );
    }

    const dentroDeVentana =
      destino.ventanaExpiraEn !== null &&
      destino.ventanaExpiraEn.getTime() > Date.now();
    if (!dentroDeVentana) {
      throw new BadRequestException(
        'El chat destino está fuera de la ventana de 24h — solo se pueden enviar plantillas',
      );
    }

    const { phoneNumberId, accessToken } = await this.credenciales(
      organizacionId,
    );

    let enviados = 0;
    const fallidos: { mensajeId: string; error: string }[] = [];

    for (const mensajeId of mensajeIds) {
      try {
        await this.reenviarUno(
          organizacionId,
          conversacionOrigenId,
          mensajeId,
          conversacionDestinoId,
          destino.waId,
          phoneNumberId,
          accessToken,
          ctx,
        );
        enviados += 1;
      } catch (err) {
        fallidos.push({
          mensajeId,
          error: mensajeError(err),
        });
      }
    }

    if (enviados === 0) {
      throw new BadRequestException(
        fallidos[0]?.error ?? 'No se pudo reenviar ningún mensaje',
      );
    }

    return { enviados, fallidos };
  }

  private async reenviarUno(
    organizacionId: string,
    conversacionOrigenId: string,
    mensajeId: string,
    conversacionDestinoId: string,
    destinoWaId: string,
    phoneNumberId: string,
    accessToken: string,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ): Promise<void> {
    const mensaje = await this.conversaciones.buscarMensajeParaReenviar(
      organizacionId,
      mensajeId,
    );
    if (!mensaje || mensaje.whatsappConversacionId !== conversacionOrigenId) {
      throw new NotFoundException('Mensaje no encontrado');
    }
    if (mensaje.tipo === 'template' || mensaje.tipo === 'interactive') {
      throw new BadRequestException(
        'No se pueden reenviar plantillas ni mensajes interactivos',
      );
    }

    if (TIPOS_MEDIA.has(mensaje.tipo)) {
      if (!mensaje.mediaBytes || !mensaje.mediaMimeType) {
        throw new BadRequestException(
          'Este archivo ya no está disponible para reenviar',
        );
      }
      const categoria =
        (mensaje.tipo as TipoMediaWhatsApp) ||
        categoriaMediaPorMimeType(mensaje.mediaMimeType);
      if (!categoria || !TIPOS_MEDIA.has(categoria)) {
        throw new BadRequestException('Tipo de archivo no reenviable');
      }
      const subido = await this.graph.subirMediaWhatsApp(
        phoneNumberId,
        accessToken,
        mensaje.mediaBytes,
        mensaje.mediaMimeType,
        mensaje.mediaNombreArchivo ?? undefined,
      );
      const enviado = await this.graph.enviarMediaWhatsApp(
        phoneNumberId,
        accessToken,
        destinoWaId,
        categoria,
        subido.mediaId,
        {
          caption: mensaje.mediaCaption ?? mensaje.texto ?? undefined,
          filename: mensaje.mediaNombreArchivo ?? undefined,
        },
      );
      await this.conversaciones.registrarMensaje({
        organizacionId,
        whatsappConversacionId: conversacionDestinoId,
        wamid: enviado.wamid,
        direccion: 'saliente',
        tipo: categoria,
        texto: mensaje.mediaCaption ?? mensaje.texto ?? undefined,
        estadoEntrega: 'enviado',
        datosCrudos: { tipo: categoria, reenviadoDe: mensajeId },
        mediaId: subido.mediaId,
        mediaMimeType: mensaje.mediaMimeType,
        mediaNombreArchivo: mensaje.mediaNombreArchivo ?? undefined,
        mediaCaption: mensaje.mediaCaption ?? undefined,
        mediaEsVoz: mensaje.mediaEsVoz ?? undefined,
        mediaTamanoBytes: mensaje.mediaBytes.length,
        mediaBytes: mensaje.mediaBytes,
        fechaMensaje: new Date(),
        usuarioCreacion: ctx.usuarioId,
      });
      await this.conversaciones.actualizarTrasSaliente(
        conversacionDestinoId,
        new Date(),
      );
      return;
    }

    if (mensaje.tipo === 'location') {
      if (
        mensaje.ubicacionLatitud === null ||
        mensaje.ubicacionLongitud === null
      ) {
        throw new BadRequestException('Ubicación incompleta');
      }
      const ubicacion = {
        latitud: mensaje.ubicacionLatitud,
        longitud: mensaje.ubicacionLongitud,
        nombre: mensaje.ubicacionNombre ?? undefined,
        direccion: mensaje.ubicacionDireccion ?? undefined,
      };
      const enviado = await this.graph.enviarUbicacionWhatsApp(
        phoneNumberId,
        accessToken,
        destinoWaId,
        ubicacion,
      );
      await this.conversaciones.registrarMensaje({
        organizacionId,
        whatsappConversacionId: conversacionDestinoId,
        wamid: enviado.wamid,
        direccion: 'saliente',
        tipo: 'location',
        estadoEntrega: 'enviado',
        datosCrudos: { tipo: 'location', reenviadoDe: mensajeId },
        fechaMensaje: new Date(),
        usuarioCreacion: ctx.usuarioId,
        ubicacionLatitud: ubicacion.latitud,
        ubicacionLongitud: ubicacion.longitud,
        ubicacionNombre: ubicacion.nombre,
        ubicacionDireccion: ubicacion.direccion,
      });
      await this.conversaciones.actualizarTrasSaliente(
        conversacionDestinoId,
        new Date(),
      );
      return;
    }

    if (mensaje.tipo === 'contacts') {
      const lista = normalizarContactos(mensaje.contactos);
      if (lista.length === 0) {
        throw new BadRequestException('Contacto incompleto');
      }
      const enviado = await this.graph.enviarContactoWhatsApp(
        phoneNumberId,
        accessToken,
        destinoWaId,
        lista,
      );
      await this.conversaciones.registrarMensaje({
        organizacionId,
        whatsappConversacionId: conversacionDestinoId,
        wamid: enviado.wamid,
        direccion: 'saliente',
        tipo: 'contacts',
        estadoEntrega: 'enviado',
        datosCrudos: { tipo: 'contacts', reenviadoDe: mensajeId },
        fechaMensaje: new Date(),
        usuarioCreacion: ctx.usuarioId,
        contactos: lista,
      });
      await this.conversaciones.actualizarTrasSaliente(
        conversacionDestinoId,
        new Date(),
      );
      return;
    }

    const texto = mensaje.texto?.trim();
    if (!texto) {
      throw new BadRequestException('No hay contenido para reenviar');
    }
    const enviado = await this.graph.enviarMensajeTextoWhatsApp(
      phoneNumberId,
      accessToken,
      destinoWaId,
      texto,
    );
    await this.conversaciones.registrarMensaje({
      organizacionId,
      whatsappConversacionId: conversacionDestinoId,
      wamid: enviado.wamid,
      direccion: 'saliente',
      tipo: 'text',
      texto,
      estadoEntrega: 'enviado',
      datosCrudos: { tipo: 'text', reenviadoDe: mensajeId },
      fechaMensaje: new Date(),
      usuarioCreacion: ctx.usuarioId,
    });
    await this.conversaciones.actualizarTrasSaliente(
      conversacionDestinoId,
      new Date(),
    );
  }

  private assertPuedeEscribir(
    conversacion: { lead: { asignadoUsuarioId: string | null } | null },
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ): void {
    const esAdmin = ROLES_ADMIN.includes(ctx.rol);
    const esDueno = conversacion.lead?.asignadoUsuarioId === ctx.usuarioId;
    if (!esAdmin && !esDueno) {
      throw new ForbiddenException(
        'Solo el dueño del lead o un administrador puede reenviar a este chat',
      );
    }
  }

  private async credenciales(organizacionId: string): Promise<{
    phoneNumberId: string;
    accessToken: string;
  }> {
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
    return {
      phoneNumberId: conexionActiva.phoneNumberId,
      accessToken: this.tokenEncryption.decrypt(conexion.tokenCifrado),
    };
  }
}

function normalizarContactos(
  contactos: ContactoMensajeRow | ContactoMensajeRow[] | null,
): ContactoMensajeRow[] {
  if (!contactos) return [];
  return Array.isArray(contactos) ? contactos : [contactos];
}

function mensajeError(err: unknown): string {
  if (err instanceof HttpException) {
    const res = err.getResponse();
    if (typeof res === 'string') return res;
    if (typeof res === 'object' && res !== null && 'message' in res) {
      const msg = (res as { message: string | string[] }).message;
      return Array.isArray(msg) ? msg.join(', ') : String(msg);
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Error al reenviar';
}
