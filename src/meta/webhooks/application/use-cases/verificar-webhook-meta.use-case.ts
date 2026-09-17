import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { META_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../connections/application/ports/meta-conexiones.repository.port';
import { META_PAGINAS_REPOSITORY } from '../../../pages/application/ports/meta-paginas.repository.port';
import type { MetaPaginasRepository } from '../../../pages/application/ports/meta-paginas.repository.port';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../../whatsapp/connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../../../../whatsapp/connections/application/ports/whatsapp-conexiones.repository.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import type { LeadgenWebhookPayload } from '../../domain/leadgen-webhook-payload.interface';
import type { WhatsappWebhookPayload } from '../../domain/whatsapp-webhook-payload.interface';
import { verificarFirmaWebhook } from '../../infrastructure/verificar-firma-webhook';

/** page_id reales en leadgen (value.page_id + entry.id cuando object=page). */
function extraerPageIdsLeadgen(payload: LeadgenWebhookPayload): string[] {
  const ids = new Set<string>();
  for (const entry of payload.entry ?? []) {
    if (payload.object === 'page' && entry.id) ids.add(entry.id);
    for (const change of entry.changes ?? []) {
      const pageId = change.value?.page_id;
      if (pageId) ids.add(pageId);
    }
  }
  return [...ids];
}

/** phone_number_id + WABA (entry.id) en payloads WhatsApp. */
function extraerIdsWhatsApp(payload: WhatsappWebhookPayload): {
  phoneNumberIds: string[];
  wabaIds: string[];
} {
  const phones = new Set<string>();
  const wabas = new Set<string>();
  for (const entry of payload.entry ?? []) {
    if (entry.id) wabas.add(entry.id);
    for (const change of entry.changes ?? []) {
      const phone = change.value?.metadata?.phone_number_id;
      if (phone) phones.add(phone);
    }
  }
  return { phoneNumberIds: [...phones], wabaIds: [...wabas] };
}

@Injectable()
export class VerificarWebhookMetaUseCase {
  constructor(
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(META_PAGINAS_REPOSITORY)
    private readonly paginas: MetaPaginasRepository,
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly whatsappConexiones: WhatsappConexionesRepository,
    private readonly config: ConfigService,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async esSuscripcionValida(
    mode: string,
    verifyToken: string,
  ): Promise<boolean> {
    if (mode !== 'subscribe') return false;

    const globalToken = this.config.get<string>('META_VERIFY_TOKEN');
    if (globalToken && verifyToken === globalToken) return true;

    const conexion =
      await this.conexiones.findActivaPorWebhookVerifyToken(verifyToken);
    return conexion !== null;
  }

  /**
   * HMAC atado al tenant del recurso del payload.
   * Nunca prueba secrets de otras orgs (evita forge cross-tenant).
   * Legacy META_APP_SECRET solo si no hay secret por conexión resuelta.
   */
  async verificarFirma(
    rawBody: Buffer,
    signature: string | undefined,
    payload: LeadgenWebhookPayload | WhatsappWebhookPayload,
  ): Promise<boolean> {
    const secrets = await this.resolverSecretsDelPayload(payload);
    for (const secret of secrets) {
      if (verificarFirmaWebhook(rawBody, signature, secret)) return true;
    }

    if (secrets.length === 0) {
      const legacySecret = this.config.get<string>('META_APP_SECRET');
      if (
        legacySecret &&
        verificarFirmaWebhook(rawBody, signature, legacySecret)
      ) {
        return true;
      }
    }

    return false;
  }

  private async resolverSecretsDelPayload(
    payload: LeadgenWebhookPayload | WhatsappWebhookPayload,
  ): Promise<string[]> {
    const secrets = new Map<string, string>();

    if (payload.object === 'whatsapp_business_account') {
      const { phoneNumberIds, wabaIds } = extraerIdsWhatsApp(
        payload as WhatsappWebhookPayload,
      );

      for (const phoneNumberId of phoneNumberIds) {
        const wa = await this.whatsappConexiones.findPorPhoneNumberId(
          phoneNumberId,
        );
        if (!wa) continue;
        await this.agregarSecretDeMetaConexion(
          wa.metaConexionId,
          wa.organizacionId,
          secrets,
        );
      }

      for (const wabaId of wabaIds) {
        const wa = await this.whatsappConexiones.findPorWabaId(wabaId);
        if (!wa) continue;
        await this.agregarSecretDeMetaConexion(
          wa.metaConexionId,
          wa.organizacionId,
          secrets,
        );
      }

      return [...secrets.values()];
    }

    // leadgen / page (y cualquier otro object con page_id)
    for (const pageId of extraerPageIdsLeadgen(
      payload as LeadgenWebhookPayload,
    )) {
      const pagina = await this.paginas.findActivaPorPageId(pageId);
      if (!pagina?.conexionAppSecretCifrado) continue;
      if (secrets.has(pagina.metaConexionId)) continue;
      secrets.set(
        pagina.metaConexionId,
        this.tokenEncryption.decrypt(pagina.conexionAppSecretCifrado),
      );
    }

    return [...secrets.values()];
  }

  private async agregarSecretDeMetaConexion(
    metaConexionId: string,
    organizacionId: string,
    secrets: Map<string, string>,
  ): Promise<void> {
    if (secrets.has(metaConexionId)) return;
    const conexion =
      await this.conexiones.findActivaPorOrganizacion(organizacionId);
    if (!conexion?.appSecretCifrado || conexion.id !== metaConexionId) {
      // Si el id no coincide (rotación rara), igual usamos la conexión activa
      // de esa org — nunca otra org.
      if (!conexion?.appSecretCifrado) return;
      if (secrets.has(conexion.id)) return;
      secrets.set(
        conexion.id,
        this.tokenEncryption.decrypt(conexion.appSecretCifrado),
      );
      return;
    }
    secrets.set(
      metaConexionId,
      this.tokenEncryption.decrypt(conexion.appSecretCifrado),
    );
  }
}
