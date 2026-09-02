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

const ROLES_ADMIN: RolOrganizacion[] = ['PROPIETARIO', 'ADMINISTRADOR'];

export interface EnviarUbicacionInput {
  latitud: number;
  longitud: number;
  nombre?: string;
  direccion?: string;
  respondeAMensajeId?: string;
}

/** Mandar una ubicación (coordenadas) — mismo botón "+" que un archivo en
 * WhatsApp real, mismo criterio: solo funciona dentro de la ventana de 24h,
 * no hay plantilla equivalente para ubicaciones fuera de ventana. */
@Injectable()
export class EnviarUbicacionWhatsAppUseCase {
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
    input: EnviarUbicacionInput,
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
        'Solo el dueño del lead o un administrador puede escribir en este chat',
      );
    }

    const dentroDeVentana =
      conversacion.ventanaExpiraEn !== null &&
      conversacion.ventanaExpiraEn.getTime() > Date.now();
    if (!dentroDeVentana) {
      throw new BadRequestException(
        'Pasaron 24h desde el último mensaje del contacto — fuera de la ventana no se pueden enviar ubicaciones',
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

    const resultado = await this.graph.enviarUbicacionWhatsApp(
      conexionActiva.phoneNumberId,
      accessToken,
      conversacion.waId,
      {
        latitud: input.latitud,
        longitud: input.longitud,
        nombre: input.nombre,
        direccion: input.direccion,
      },
      respondeAWamid,
    );

    await this.conversaciones.registrarMensaje({
      organizacionId,
      whatsappConversacionId: conversacionId,
      wamid: resultado.wamid,
      direccion: 'saliente',
      tipo: 'location',
      estadoEntrega: 'enviado',
      datosCrudos: { tipo: 'location', ubicacion: input },
      fechaMensaje: new Date(),
      usuarioCreacion: ctx.usuarioId,
      respondeAMensajeId: input.respondeAMensajeId,
      ubicacionLatitud: input.latitud,
      ubicacionLongitud: input.longitud,
      ubicacionNombre: input.nombre,
      ubicacionDireccion: input.direccion,
    });
  }
}
