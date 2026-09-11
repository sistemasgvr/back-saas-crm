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
  ConversacionResumen,
  WhatsappConversacionesRepository,
} from '../ports/whatsapp-conversaciones.repository.port';
import type { RolOrganizacion } from '../../../../auth/domain/request-context.interface';
import { categoriaMediaPorMimeType } from '../limites-media-whatsapp';
import { puedeEscribirConversacionWhatsApp } from '../../domain/acceso-conversacion-whatsapp';

/** Tope alineado con el multi-forward de la app WhatsApp (~30). */
export const MAX_MENSAJES_REENVIAR = 30;

/** Tope de chats destino por reenvío (WhatsApp multi-forward típico: 5). */
export const MAX_DESTINOS_REENVIAR = 5;

const TIPOS_MEDIA = new Set([
  'image',
  'video',
  'audio',
  'document',
  'sticker',
]);

export type ReenviarLoteFallido = {
  conversacionDestinoId: string;
  mensajeId: string;
  error: string;
};

export type ReenviarLoteResultado = {
  enviados: number;
  fallidos: ReenviarLoteFallido[];
};

/**
 * Reenvía el contenido de uno o varios mensajes a uno o varios chats (la Cloud
 * API no tiene "forward" nativo: se vuelve a enviar el mismo payload).
 * Cada destino debe estar dentro de la ventana de 24h.
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
      [conversacionDestinoId],
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
    conversacionDestinoIds: string[],
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

    const destinosUnicos = [...new Set(conversacionDestinoIds.filter(Boolean))];
    if (
      destinosUnicos.length < 1 ||
      destinosUnicos.length > MAX_DESTINOS_REENVIAR
    ) {
      throw new BadRequestException(
        `Elige entre 1 y ${MAX_DESTINOS_REENVIAR} chats destino`,
      );
    }

    if (destinosUnicos.includes(conversacionOrigenId)) {
      throw new BadRequestException(
        'Elige otro chat para reenviar — no se puede reenviar al mismo',
      );
    }

    const origen = await this.conversaciones.findPorId(
      organizacionId,
      conversacionOrigenId,
    );
    if (!origen) {
      throw new NotFoundException('Conversación de origen no encontrada');
    }

    const { phoneNumberId, accessToken } = await this.credenciales(
      organizacionId,
    );

    let enviados = 0;
    const fallidos: ReenviarLoteFallido[] = [];

    for (const destinoId of destinosUnicos) {
      const destino = await this.conversaciones.findPorId(
        organizacionId,
        destinoId,
      );
      if (!destino) {
        for (const mensajeId of mensajeIds) {
          fallidos.push({
            conversacionDestinoId: destinoId,
            mensajeId,
            error: 'Conversación destino no encontrada',
          });
        }
        continue;
      }

      const rechazoDestino = this.validarDestino(destino, ctx);
      if (rechazoDestino) {
        for (const mensajeId of mensajeIds) {
          fallidos.push({
            conversacionDestinoId: destinoId,
            mensajeId,
            error: rechazoDestino,
          });
        }
        continue;
      }

      for (const mensajeId of mensajeIds) {
        try {
          await this.reenviarUno(
            organizacionId,
            conversacionOrigenId,
            mensajeId,
            destinoId,
            destino.waId,
            phoneNumberId,
            accessToken,
            ctx,
          );
          enviados += 1;
        } catch (err) {
          fallidos.push({
            conversacionDestinoId: destinoId,
            mensajeId,
            error: mensajeError(err),
          });
        }
      }
    }

    if (enviados === 0) {
      throw new BadRequestException(
        fallidos[0]?.error ?? 'No se pudo reenviar ningún mensaje',
      );
    }

    return { enviados, fallidos };
  }

  /** null = ok; string = motivo de rechazo (ventana 24h, bloqueado, etc.). */
  private validarDestino(
    destino: ConversacionResumen,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ): string | null {
    try {
      this.assertPuedeEscribir(destino, ctx);
    } catch (err) {
      return mensajeError(err);
    }
    if (destino.bloqueado) {
      return 'Ese contacto está bloqueado — desbloquéalo antes de reenviar';
    }
    const dentroDeVentana =
      destino.ventanaExpiraEn !== null &&
      destino.ventanaExpiraEn.getTime() > Date.now();
    if (!dentroDeVentana) {
      return 'Fuera de la ventana de 24h — solo se pueden enviar plantillas';
    }
    return null;
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
  }

  private assertPuedeEscribir(
    conversacion: { lead: { asignadoUsuarioId: string | null } | null },
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ): void {
    if (!puedeEscribirConversacionWhatsApp(conversacion.lead, ctx)) {
      throw new ForbiddenException(
        'Solo el dueño del lead, un administrador o un chat libre pueden reenviar a este chat',
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
