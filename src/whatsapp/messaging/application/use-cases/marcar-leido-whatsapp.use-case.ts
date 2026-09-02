import { Inject, Injectable } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';

/**
 * Le manda a Meta la confirmación de lectura (check azul) del último mensaje
 * del contacto — y, si `escribiendo` viene en true, el indicador de
 * "escribiendo…" pegado al mismo llamado (así lo expone la Cloud API, no hay
 * endpoint aparte). Deliberadamente silenciosa ante cualquier falta de
 * configuración (sin conexión de WhatsApp, sin token, sin mensajes
 * entrantes todavía) — esto es un efecto secundario de UX, nunca debe
 * romper el flujo de abrir un chat o escribir un mensaje.
 */
@Injectable()
export class MarcarLeidoWhatsAppUseCase {
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
    opciones?: { escribiendo?: boolean },
  ): Promise<void> {
    const wamid =
      await this.conversaciones.buscarUltimoWamidEntrante(conversacionId);
    if (!wamid) return;

    const whatsappConexion =
      await this.conexionesWa.listarPorOrganizacion(organizacionId);
    const conexionActiva = whatsappConexion[0];
    if (!conexionActiva) return;

    const conexion =
      await this.conexiones.findActivaPorOrganizacion(organizacionId);
    if (!conexion?.tokenCifrado) return;
    const accessToken = this.tokenEncryption.decrypt(conexion.tokenCifrado);

    await this.graph.enviarConfirmacionLecturaWhatsApp(
      conexionActiva.phoneNumberId,
      accessToken,
      wamid,
      opciones?.escribiendo,
    );
  }
}
