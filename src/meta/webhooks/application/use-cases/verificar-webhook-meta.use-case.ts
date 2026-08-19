import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { META_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../connections/application/ports/meta-conexiones.repository.port';
import { META_PAGINAS_REPOSITORY } from '../../../pages/application/ports/meta-paginas.repository.port';
import type { MetaPaginasRepository } from '../../../pages/application/ports/meta-paginas.repository.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import type { LeadgenWebhookPayload } from '../../domain/leadgen-webhook-payload.interface';
import { verificarFirmaWebhook } from '../../infrastructure/verificar-firma-webhook';

function extraerPageIds(payload: LeadgenWebhookPayload): string[] {
  const ids = new Set<string>();
  for (const entry of payload.entry ?? []) {
    if (entry.id) ids.add(entry.id);
    for (const change of entry.changes ?? []) {
      const pageId = change.value?.page_id;
      if (pageId) ids.add(pageId);
    }
  }
  return [...ids];
}

@Injectable()
export class VerificarWebhookMetaUseCase {
  constructor(
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(META_PAGINAS_REPOSITORY)
    private readonly paginas: MetaPaginasRepository,
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

  async verificarFirma(
    rawBody: Buffer,
    signature: string | undefined,
    payload: LeadgenWebhookPayload,
  ): Promise<boolean> {
    const pageIds = extraerPageIds(payload);
    const probados = new Set<string>();

    for (const pageId of pageIds) {
      const pagina = await this.paginas.findActivaPorPageId(pageId);
      if (
        pagina?.conexionAppSecretCifrado &&
        !probados.has(pagina.metaConexionId)
      ) {
        probados.add(pagina.metaConexionId);
        const secret = this.tokenEncryption.decrypt(
          pagina.conexionAppSecretCifrado,
        );
        if (verificarFirmaWebhook(rawBody, signature, secret)) return true;
      }
    }

    const conexiones = await this.conexiones.listActivasConAppSecret();
    for (const conexion of conexiones) {
      if (!conexion.appSecretCifrado || probados.has(conexion.id)) continue;
      probados.add(conexion.id);
      const secret = this.tokenEncryption.decrypt(conexion.appSecretCifrado);
      if (verificarFirmaWebhook(rawBody, signature, secret)) return true;
    }

    const legacySecret = this.config.get<string>('META_APP_SECRET');
    if (legacySecret && verificarFirmaWebhook(rawBody, signature, legacySecret))
      return true;

    return false;
  }
}
