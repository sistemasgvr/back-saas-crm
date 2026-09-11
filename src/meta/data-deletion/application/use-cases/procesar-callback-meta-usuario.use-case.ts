import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { META_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../connections/application/ports/meta-conexiones.repository.port';
import { META_PAGINAS_REPOSITORY } from '../../../pages/application/ports/meta-paginas.repository.port';
import type { MetaPaginasRepository } from '../../../pages/application/ports/meta-paginas.repository.port';
import { META_CUENTAS_PUBLICITARIAS_REPOSITORY } from '../../../ad-accounts/application/ports/meta-cuentas-publicitarias.repository.port';
import type { MetaCuentasPublicitariasRepository } from '../../../ad-accounts/application/ports/meta-cuentas-publicitarias.repository.port';
import { META_GRAPH_CLIENT } from '../../../connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { parseSignedRequest } from '../../domain/parse-signed-request';
import {
  META_ELIMINACION_DATOS_REPOSITORY,
  type MetaEliminacionDatosRepository,
  type TipoSolicitudEliminacion,
} from '../ports/meta-eliminacion-datos.repository.port';

export interface RespuestaCallbackEliminacion {
  url: string;
  confirmation_code: string;
}

/**
 * Data Deletion Callback + Deauthorize Callback de Meta.
 * Borra los datos del usuario de Facebook que conectó la app
 * (tokens OAuth, vínculo de páginas/cuentas). Los leads CRM de la
 * organización (terceros) no se eliminan — no son datos personales de
 * ese usuario de Meta.
 */
@Injectable()
export class ProcesarCallbackMetaUsuarioUseCase {
  private readonly logger = new Logger(ProcesarCallbackMetaUsuarioUseCase.name);

  constructor(
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(META_PAGINAS_REPOSITORY)
    private readonly paginas: MetaPaginasRepository,
    @Inject(META_CUENTAS_PUBLICITARIAS_REPOSITORY)
    private readonly cuentas: MetaCuentasPublicitariasRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    @Inject(META_ELIMINACION_DATOS_REPOSITORY)
    private readonly solicitudes: MetaEliminacionDatosRepository,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly config: ConfigService,
  ) {}

  async execute(
    signedRequest: string | undefined,
    tipo: TipoSolicitudEliminacion,
  ): Promise<RespuestaCallbackEliminacion> {
    if (!signedRequest?.trim()) {
      throw new BadRequestException('signed_request requerido');
    }

    const payload = await this.verificarContraSecretos(signedRequest.trim());
    if (!payload) {
      throw new BadRequestException('signed_request inválido');
    }

    const confirmationCode = this.generarCodigo();
    const conexion = await this.conexiones.findPorMetaUserId(payload.user_id);

    let estado: 'PROCESADA' | 'NO_ENCONTRADA' = 'NO_ENCONTRADA';
    let detalle =
      'No había una conexión Meta activa asociada a este usuario de Facebook.';

    if (conexion) {
      await this.revocarDatosUsuarioMeta(conexion.organizacionId, conexion.id);
      estado = 'PROCESADA';
      detalle =
        tipo === 'DEAUTHORIZE'
          ? 'Sesión Meta revocada (deauthorize): tokens OAuth y vínculos de páginas/cuentas limpiados.'
          : 'Datos del usuario Meta eliminados: tokens OAuth y vínculos de páginas/cuentas limpiados.';
    }

    await this.solicitudes.crear({
      confirmationCode,
      metaUserId: payload.user_id,
      organizacionId: conexion?.organizacionId ?? null,
      metaConexionId: conexion?.id ?? null,
      tipo,
      estado,
      detalle,
    });

    const frontendUrl = this.config
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/$/, '');

    return {
      url: `${frontendUrl}/eliminacion-datos/${confirmationCode}`,
      confirmation_code: confirmationCode,
    };
  }

  private async verificarContraSecretos(signedRequest: string) {
    const conexiones = await this.conexiones.listActivasConAppSecret();
    const secretosProbados = new Set<string>();

    for (const conexion of conexiones) {
      if (!conexion.appSecretCifrado) continue;
      let secret: string;
      try {
        secret = this.tokenEncryption.decrypt(conexion.appSecretCifrado);
      } catch {
        continue;
      }
      if (secretosProbados.has(secret)) continue;
      secretosProbados.add(secret);
      const parsed = parseSignedRequest(signedRequest, secret);
      if (parsed) return parsed;
    }

    const legacy = this.config.get<string>('META_APP_SECRET');
    if (legacy && !secretosProbados.has(legacy)) {
      return parseSignedRequest(signedRequest, legacy);
    }

    return null;
  }

  private async revocarDatosUsuarioMeta(
    organizacionId: string,
    conexionId: string,
  ) {
    const paginasDesvinculadas =
      await this.paginas.desvincularTodasDeOrganizacion(
        organizacionId,
        conexionId,
      );
    await Promise.allSettled(
      paginasDesvinculadas
        .filter((pagina) => pagina.tokenPaginaCifrado)
        .map(async (pagina) => {
          try {
            const pageAccessToken = this.tokenEncryption.decrypt(
              pagina.tokenPaginaCifrado!,
            );
            await this.graph.desuscribirPaginaLeadgen(
              pagina.pageId,
              pageAccessToken,
            );
          } catch (error) {
            this.logger.warn(
              `No se pudo desuscribir la página ${pagina.pageId} en eliminación Meta`,
              error instanceof Error ? error.stack : error,
            );
          }
        }),
    );

    await this.cuentas.desvincularTodasDeOrganizacion(
      organizacionId,
      conexionId,
    );
    await this.conexiones.limpiarConexionOAuth(conexionId, conexionId);
  }

  private generarCodigo(): string {
    return `del_${randomBytes(12).toString('hex')}`;
  }
}
