import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../ports/whatsapp-conexiones.repository.port';

@Injectable()
export class VincularNumeroUseCase {
  private readonly logger = new Logger(VincularNumeroUseCase.name);

  constructor(
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly whatsappConexiones: WhatsappConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(
    organizacionId: string,
    wabaId: string,
    phoneNumberId: string,
    _numeroDisplay: string | undefined,
    _nombreVerificado: string | undefined,
    usuarioEdicion: string,
  ) {
    const conexion =
      await this.conexiones.findActivaPorOrganizacion(organizacionId);
    if (!conexion?.tokenCifrado) {
      throw new NotFoundException(
        'No hay una sesión de Meta conectada para esta organización',
      );
    }

    const accessToken = this.tokenEncryption.decrypt(conexion.tokenCifrado);
    // El selector puede estar desactualizado. Meta, no los datos del navegador,
    // debe confirmar la pareja WABA/número y su conexión actual con Cloud API.
    const disponibles = await this.graph.listarNumerosWhatsApp(accessToken);
    const activo = disponibles.find(
      (n) => n.wabaId === wabaId && n.phoneNumberId === phoneNumberId,
    );
    if (!activo)
      throw new ForbiddenException(
        'El número ya no está disponible en la cuenta de Meta de esta empresa. Actualiza el listado.',
      );
    const existente =
      await this.whatsappConexiones.findPorPhoneNumberId(phoneNumberId);
    if (existente && existente.organizacionId !== organizacionId)
      throw new ConflictException(
        'El número ya pertenece a otra organización del CRM.',
      );
    const salud = await this.graph.obtenerSaludNumeroWhatsApp(
      phoneNumberId,
      accessToken,
    );
    if (salud.status !== 'CONNECTED' || salud.platform_type !== 'CLOUD_API')
      throw new BadRequestException(
        salud.is_on_biz_app
          ? 'El número funciona en WhatsApp Business, pero Meta todavía no confirma su conexión con Cloud API. Completa el alta de coexistencia del mismo número antes de vincularlo al CRM.'
          : 'Meta todavía no confirma este número conectado a Cloud API. Completa su configuración en Meta y vuelve a vincularlo.',
      );

    const numero = await this.whatsappConexiones.vincular({
      organizacionId,
      metaConexionId: conexion.id,
      wabaId,
      phoneNumberId,
      numeroDisplay: activo.displayPhoneNumber,
      nombreVerificado: activo.verifiedName,
      estadoNumero: salud.status,
      usuarioEdicion,
    });

    try {
      await this.graph.suscribirWabaWebhook(wabaId, accessToken);
      await this.whatsappConexiones.marcarWebhookSuscrito(
        numero.id,
        usuarioEdicion,
      );
    } catch (error) {
      // No revertimos la vinculación — igual que Páginas (Fase 13), queda
      // vinculado sin webhook y se puede reintentar (PLAN §9 checklist Meta).
      this.logger.warn(
        `No se pudo suscribir el WABA ${wabaId} al webhook — se vinculó sin suscripción`,
        error instanceof Error ? error.stack : error,
      );
    }

    return this.whatsappConexiones.findPorId(organizacionId, numero.id);
  }
}
