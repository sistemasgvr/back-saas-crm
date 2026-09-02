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
import {
  WHATSAPP_CONVERSACIONES_REPOSITORY,
  type InteractivoMensajeRow,
} from '../ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';
import type { RolOrganizacion } from '../../../../auth/domain/request-context.interface';

const ROLES_ADMIN: RolOrganizacion[] = ['PROPIETARIO', 'ADMINISTRADOR'];
const MAX_BOTONES = 3;
const MAX_FILAS_TOTAL = 10;

export interface EnviarInteractivoInput extends InteractivoMensajeRow {
  respondeAMensajeId?: string;
}

/** Botones de respuesta rápida, lista de opciones, botón con link (cta_url)
 * o pedido de ubicación — los 4 subtipos de "interactive" que expone la
 * Cloud API. Mismo criterio de ventana que texto/media/ubicación/contacto:
 * solo dentro de las 24h, no hay plantilla equivalente para ninguno. */
@Injectable()
export class EnviarInteractivoWhatsAppUseCase {
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
    input: EnviarInteractivoInput,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ): Promise<void> {
    this.validar(input);

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
        'Pasaron 24h desde el último mensaje del contacto — fuera de la ventana no se pueden enviar mensajes interactivos',
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

    const interactivo: InteractivoMensajeRow = {
      subtipo: input.subtipo,
      cuerpo: input.cuerpo,
      pie: input.pie,
      botones: input.botones,
      botonLista: input.botonLista,
      secciones: input.secciones,
      textoBoton: input.textoBoton,
      url: input.url,
    };

    const resultado = await this.graph.enviarInteractivoWhatsApp(
      conexionActiva.phoneNumberId,
      accessToken,
      conversacion.waId,
      interactivo,
      respondeAWamid,
    );

    await this.conversaciones.registrarMensaje({
      organizacionId,
      whatsappConversacionId: conversacionId,
      wamid: resultado.wamid,
      direccion: 'saliente',
      tipo: 'interactive',
      texto: input.cuerpo,
      estadoEntrega: 'enviado',
      datosCrudos: { tipo: 'interactive', interactivo },
      fechaMensaje: new Date(),
      usuarioCreacion: ctx.usuarioId,
      respondeAMensajeId: input.respondeAMensajeId,
      interactivo,
    });
  }

  /** Cada subtipo tiene sus propios campos obligatorios — más simple
   * validarlo acá a mano que pelear con @ValidateIf condicional en el DTO
   * (mismo criterio que el resto de los use-cases de este módulo). */
  private validar(input: EnviarInteractivoInput): void {
    if (!input.cuerpo?.trim()) {
      throw new BadRequestException('Falta el texto del mensaje');
    }

    switch (input.subtipo) {
      case 'button': {
        const botones = input.botones ?? [];
        if (botones.length === 0 || botones.length > MAX_BOTONES) {
          throw new BadRequestException(
            `Hace falta entre 1 y ${MAX_BOTONES} botones`,
          );
        }
        break;
      }
      case 'list': {
        if (!input.botonLista?.trim()) {
          throw new BadRequestException(
            'Falta el texto del botón que abre la lista',
          );
        }
        const secciones = input.secciones ?? [];
        const totalFilas = secciones.reduce((n, s) => n + s.filas.length, 0);
        if (secciones.length === 0 || totalFilas === 0) {
          throw new BadRequestException('Hace falta al menos una opción');
        }
        if (totalFilas > MAX_FILAS_TOTAL) {
          throw new BadRequestException(
            `La lista admite hasta ${MAX_FILAS_TOTAL} opciones en total`,
          );
        }
        break;
      }
      case 'cta_url': {
        if (!input.textoBoton?.trim() || !input.url?.trim()) {
          throw new BadRequestException('Falta el texto del botón o el link');
        }
        break;
      }
      case 'location_request':
        break;
    }
  }
}
