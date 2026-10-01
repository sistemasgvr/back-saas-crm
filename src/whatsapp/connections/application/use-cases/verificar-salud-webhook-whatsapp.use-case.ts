import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { CAMPOS_WEBHOOK_WHATSAPP_COEXISTENCIA } from '../../domain/campos-webhook-whatsapp';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../ports/whatsapp-conexiones.repository.port';

export interface ResultadoSaludWebhookWhatsapp {
  webhookSuscrito: boolean | null;
  suscripcionAppActiva: boolean | null;
  camposVerificados: boolean;
  numero: {
    estado: string | null;
    plataforma: string | null;
    enAppBusiness: boolean | null;
    verificacionCodigo: string | null;
    saludEnvio: string | null;
  };
  erroresEnvio: {
    codigo: number | null;
    descripcion: string;
    solucion: string | null;
  }[];
  erroresVerificacion: string[];
  verificadoEn: string;
  ultimoMensajeEntranteEn: string | null;
  camposSuscritos: string[];
  camposFaltantes: string[];
  webhookUltimoError: string | null;
}

/** Comprueba suscripción, número y envío de manera independiente. Una consulta
 * fallida es desconocida; una suscripción activa no prueba recepción real. */
@Injectable()
export class VerificarSaludWebhookWhatsappUseCase {
  private readonly logger = new Logger(
    VerificarSaludWebhookWhatsappUseCase.name,
  );
  constructor(
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly metaConexiones: MetaConexionesRepository,
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly whatsappConexiones: WhatsappConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(
    organizacionId: string,
    id: string,
    _usuarioEdicion: string,
  ): Promise<ResultadoSaludWebhookWhatsapp> {
    const conexionWa = await this.whatsappConexiones.findPorId(
      organizacionId,
      id,
    );
    if (!conexionWa) {
      throw new NotFoundException('Conexión de WhatsApp no encontrada');
    }

    const metaConexion =
      await this.metaConexiones.findActivaPorOrganizacion(organizacionId);
    if (!metaConexion?.tokenCifrado || !metaConexion.appId) {
      throw new NotFoundException(
        'No hay una sesión de Meta conectada para esta organización',
      );
    }

    const accessToken = this.tokenEncryption.decrypt(metaConexion.tokenCifrado);

    const secret = metaConexion.appSecretCifrado
      ? this.tokenEncryption.decrypt(metaConexion.appSecretCifrado)
      : null;
    const [apps, phone, subscription, ultimoMensaje] = await Promise.allSettled(
      [
        this.graph.obtenerAppsSuscritasWaba(conexionWa.wabaId, accessToken),
        this.graph.obtenerSaludNumeroWhatsApp(
          conexionWa.phoneNumberId,
          accessToken,
        ),
        secret
          ? this.graph.obtenerSuscripcionAppWhatsApp(metaConexion.appId, secret)
          : Promise.resolve(undefined),
        this.whatsappConexiones.obtenerUltimoMensajeEntrante(
          organizacionId,
          conexionWa.id,
        ),
      ],
    );
    const erroresVerificacion: string[] = [];
    const registrarFallo = (
      parte: string,
      result: PromiseSettledResult<unknown>,
    ) => {
      if (result.status === 'rejected') {
        this.logger.error(
          { err: result.reason as unknown, parte },
          'Error verificando WhatsApp en Meta',
        );
        erroresVerificacion.push(
          `No se pudo consultar ${parte}. Revisa el acceso y los permisos de Meta y vuelve a verificar.`,
        );
      }
    };
    registrarFallo('la suscripción del WABA', apps);
    registrarFallo('el estado del número', phone);
    registrarFallo('los campos del webhook', subscription);
    registrarFallo('la última recepción guardada', ultimoMensaje);

    const nuestraApp =
      apps.status === 'fulfilled'
        ? apps.value.find((app) => app.id === metaConexion.appId)
        : undefined;
    const suscrito = apps.status === 'fulfilled' ? Boolean(nuestraApp) : null;
    const sub =
      subscription.status === 'fulfilled' ? subscription.value : undefined;
    const camposVerificados = sub !== undefined;
    const camposSuscritos = sub?.campos ?? [];
    const numero = phone.status === 'fulfilled' ? phone.value : null;
    const requeridos: string[] =
      numero?.is_on_biz_app === true
        ? [...CAMPOS_WEBHOOK_WHATSAPP_COEXISTENCIA]
        : ['messages'];
    if (conexionWa.callingHabilitado && conexionWa.rolLinea !== 'MENSAJES')
      requeridos.push('calls');
    const camposFaltantes = camposVerificados
      ? requeridos.filter((field) => !camposSuscritos.includes(field))
      : [];
    const suscripcionAppActiva =
      sub === undefined ? null : (sub?.activa ?? false);
    if (!secret)
      erroresVerificacion.push(
        'No se pudieron verificar los campos del webhook: falta el secreto de la app en la conexión de Meta.',
      );
    const problemasWebhook: string[] = [];
    if (suscrito === false)
      problemasWebhook.push(
        'La app no está suscrita al WABA. Usa Re-suscribir webhook.',
      );
    if (suscripcionAppActiva === false)
      problemasWebhook.push(
        'La suscripción de WhatsApp de la app no está activa en Meta Developers.',
      );
    if (camposFaltantes.length)
      problemasWebhook.push(
        `Faltan campos en Meta Developers: ${camposFaltantes.join(', ')}.`,
      );
    const error =
      [...problemasWebhook, ...erroresVerificacion].join(' ') || null;
    // Un fallo de red deja la suscripción desconocida; no la marca como desactivada.
    if (suscrito !== null)
      await this.whatsappConexiones.marcarWebhookCheck(
        conexionWa.id,
        suscrito,
        problemasWebhook.join(' ') || null,
      );
    const erroresEnvio = (numero?.health_status?.entities ?? [])
      .filter(
        (entity) =>
          entity.can_send_message === 'BLOCKED' ||
          entity.can_send_message === 'LIMITED',
      )
      .flatMap((entity) => entity.errors ?? [])
      .map((issue) => ({
        codigo: issue.error_code ?? null,
        descripcion:
          issue.error_description ?? 'Restricción de envío informada por Meta',
        solucion: issue.possible_solution ?? null,
      }));
    return {
      webhookSuscrito: suscrito,
      suscripcionAppActiva,
      camposSuscritos,
      camposFaltantes,
      camposVerificados,
      webhookUltimoError: error,
      erroresVerificacion,
      erroresEnvio,
      numero: {
        estado: numero?.status ?? null,
        plataforma: numero?.platform_type ?? null,
        enAppBusiness: numero?.is_on_biz_app ?? null,
        verificacionCodigo: numero?.code_verification_status ?? null,
        saludEnvio: numero?.health_status?.can_send_message ?? null,
      },
      verificadoEn: new Date().toISOString(),
      ultimoMensajeEntranteEn:
        ultimoMensaje.status === 'fulfilled'
          ? (ultimoMensaje.value?.toISOString() ?? null)
          : null,
    };
  }
}
