import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import { TokenEncryptionService } from '../../../shared/infrastructure/token-encryption.service';
import { obtenerVersionGraph } from '../../../shared/infrastructure/meta-graph-version';
import { excepcionDesdeErrorMeta } from '../../../meta/connections/application/mapear-error-meta-graph';
import { META_GRAPH_CLIENT } from '../../../meta/connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../meta/connections/application/ports/meta-graph-client.port';
import { WHATSAPP_CONEXIONES_REPOSITORY } from './ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from './ports/whatsapp-conexiones.repository.port';

interface Numero {
  id: string;
  display_phone_number: string;
  verified_name: string;
  is_on_biz_app?: boolean;
  platform_type?: string;
  status?: string;
}

/** Alta para aplicaciones propias de cada organización. El OAuth existente sigue
 * siendo la credencial de operación; el token Embedded solo acredita el alta.
 * No reemplazar el OAuth de páginas/publicidad por un token de WhatsApp. */
@Injectable()
export class CoexistenciaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly encryption: TokenEncryptionService,
    private readonly http: HttpService,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly lineas: WhatsappConexionesRepository,
  ) {}

  private async conexion(organizacionId: string) {
    const c = await this.prisma.metaConexion.findFirst({
      where: { organizacionId, estado: 1 },
    });
    if (!c?.appId || !c.appSecretCifrado || !c.tokenCifrado)
      throw new BadRequestException(
        'Conecta primero la aplicación de Meta de esta empresa.',
      );
    return {
      ...c,
      appId: c.appId,
      appSecretCifrado: c.appSecretCifrado,
      tokenCifrado: c.tokenCifrado,
    };
  }

  async configuracion(organizacionId: string) {
    const c = await this.conexion(organizacionId);
    return {
      appId: c.appId,
      configId: c.whatsappSignupConfigId,
      version: obtenerVersionGraph(this.config),
    };
  }

  async guardarConfiguracion(
    organizacionId: string,
    usuarioId: string,
    appId: string,
    configId: string | null,
  ) {
    if (
      !/^\d{1,64}$/.test(appId) ||
      (configId !== null && !/^\d{1,64}$/.test(configId))
    )
      throw new BadRequestException(
        'El App ID y Configuration ID deben ser identificadores numéricos de hasta 64 dígitos.',
      );
    const updated = await this.prisma.metaConexion.updateMany({
      where: { organizacionId, appId, estado: 1 },
      data: { whatsappSignupConfigId: configId, usuarioEdicion: usuarioId },
    });
    if (!updated.count)
      throw new ConflictException(
        'La aplicación de esta empresa cambió o no está configurada. Actualiza la pantalla.',
      );
    return { configId };
  }

  private async get<T>(
    path: string,
    token: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    try {
      return (
        await firstValueFrom(
          this.http.get<T>(
            `https://graph.facebook.com/${obtenerVersionGraph(this.config)}${path}`,
            {
              headers: { Authorization: `Bearer ${token}` },
              params,
              timeout: 10000,
            },
          ),
        )
      ).data;
    } catch (error) {
      throw excepcionDesdeErrorMeta(error);
    }
  }
  private async post<T>(path: string, token: string, body: object): Promise<T> {
    try {
      return (
        await firstValueFrom(
          this.http.post<T>(
            `https://graph.facebook.com/${obtenerVersionGraph(this.config)}${path}`,
            body,
            { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 },
          ),
        )
      ).data;
    } catch (error) {
      throw excepcionDesdeErrorMeta(error);
    }
  }

  /** Se ejecuta inmediatamente al recibir el code (TTL de Meta: 30 segundos),
   * sin esperar que llegue el evento de sesión por postMessage. */
  async intercambiar(organizacionId: string, usuarioId: string, code: string) {
    const setup = await this.configuracion(organizacionId);
    if (!setup.configId)
      throw new BadRequestException(
        'Guarda el Configuration ID de Embedded Signup v4 en Configuración → WhatsApp antes de conectar.',
      );
    const c = await this.conexion(organizacionId);
    const secret = this.encryption.decrypt(c.appSecretCifrado);
    const token = await this.get<{ access_token: string }>(
      '/oauth/access_token',
      `${c.appId}|${secret}`,
      { client_id: c.appId, client_secret: secret, code },
    );
    if (!token.access_token)
      throw new BadRequestException('Meta no devolvió una credencial de alta.');
    const debug = await this.get<{
      data: { is_valid?: boolean; app_id?: string };
    }>('/debug_token', `${c.appId}|${secret}`, {
      input_token: token.access_token,
    });
    if (!debug.data.is_valid || debug.data.app_id !== c.appId)
      throw new ForbiddenException(
        'La autorización no pertenece a la aplicación de esta empresa.',
      );
    const session = await this.prisma.whatsappOnboarding.create({
      data: {
        organizacionId,
        usuarioId,
        metaConexionId: c.id,
        appId: c.appId,
        tokenCifrado: this.encryption.encrypt(token.access_token),
        expiraEn: new Date(Date.now() + 15 * 60_000),
      },
    });
    return { sessionId: session.id };
  }

  async completar(
    organizacionId: string,
    usuarioId: string,
    sessionId: string,
    wabaId: string,
    phoneNumberId?: string,
  ) {
    const c = await this.conexion(organizacionId);
    const s = await this.prisma.whatsappOnboarding.findFirst({
      where: {
        id: sessionId,
        organizacionId,
        usuarioId,
        metaConexionId: c.id,
        appId: c.appId,
      },
    });
    if (!s)
      throw new ForbiddenException(
        'La sesión de alta no pertenece a esta empresa y usuario.',
      );
    if (s.estado === 'COMPLETO')
      return { ok: true, phoneNumberId: s.phoneNumberId };
    if (s.expiraEn < new Date())
      throw new BadRequestException(
        'La sesión expiró. Vuelve a conectar tu WhatsApp Business.',
      );
    // Una sola ejecución: las operaciones de sincronización solo se pueden solicitar una vez.
    const claimed = await this.prisma.whatsappOnboarding.updateMany({
      where: { id: s.id, estado: 'TOKEN' },
      data: { estado: 'PROCESANDO' },
    });
    if (!claimed.count)
      throw new ConflictException(
        'Esta alta ya está en proceso o necesita revisión. No repitas la sincronización.',
      );
    try {
      const grant = this.encryption.decrypt(s.tokenCifrado);
      const result = await this.get<{ data: Numero[] }>(
        `/${wabaId}/phone_numbers`,
        grant,
        {
          fields:
            'id,display_phone_number,verified_name,is_on_biz_app,platform_type,status',
          limit: '100',
        },
      );
      const candidates = result.data.filter(
        (n) => n.is_on_biz_app === true && n.platform_type === 'CLOUD_API',
      );
      const number = phoneNumberId
        ? candidates.find((n) => n.id === phoneNumberId)
        : candidates.length === 1
          ? candidates[0]
          : undefined;
      if (!number || number.status !== 'CONNECTED')
        throw new BadRequestException(
          'Meta todavía no confirma un único número conectado en coexistencia. Completa el alta en WhatsApp Business y revisa su estado en Meta.',
        );
      // La credencial con que operará el CRM también debe poder acceder al activo.
      const operational = this.encryption.decrypt(c.tokenCifrado);
      const owned = await this.graph.listarNumerosWhatsApp(operational);
      if (
        !owned.some((n) => n.wabaId === wabaId && n.phoneNumberId === number.id)
      )
        throw new ForbiddenException(
          'El número no es accesible con la conexión de Meta de esta empresa. Reautoriza los activos de WhatsApp antes de continuar.',
        );
      const existing = await this.lineas.findPorPhoneNumberId(number.id);
      if (existing && existing.organizacionId !== organizacionId)
        throw new ConflictException(
          'El número ya pertenece a otra organización del CRM.',
        );
      const secret = this.encryption.decrypt(c.appSecretCifrado);
      const subscription = await this.graph.obtenerSuscripcionAppWhatsApp(
        c.appId,
        secret,
      );
      const fields = [
        'messages',
        'account_update',
        'history',
        'smb_app_state_sync',
        'smb_message_echoes',
      ];
      if (
        !subscription?.activa ||
        fields.some((f) => !subscription.campos.includes(f))
      )
        throw new BadRequestException(
          'Activa en Meta los webhooks messages, account_update, history, smb_app_state_sync y smb_message_echoes antes de completar el alta.',
        );
      // Guardar el enrutamiento antes de suscribir: history puede llegar inmediatamente.
      const line = await this.lineas.vincular({
        organizacionId,
        metaConexionId: c.id,
        wabaId,
        phoneNumberId: number.id,
        numeroDisplay: number.display_phone_number,
        nombreVerificado: number.verified_name,
        estadoNumero: number.status,
        usuarioEdicion: usuarioId,
      });
      await this.graph.suscribirWabaWebhook(wabaId, operational);
      await this.lineas.marcarWebhookSuscrito(line.id, usuarioId);
      await this.prisma.whatsappOnboarding.update({
        where: { id: s.id },
        data: { wabaId, phoneNumberId: number.id },
      });
      const contacts = await this.post<{ request_id: string }>(
        `/${number.id}/smb_app_data`,
        operational,
        { messaging_product: 'whatsapp', sync_type: 'smb_app_state_sync' },
      );
      await this.prisma.whatsappOnboarding.update({
        where: { id: s.id },
        data: { contactosRequestId: contacts.request_id },
      });
      const history = await this.post<{ request_id: string }>(
        `/${number.id}/smb_app_data`,
        operational,
        { messaging_product: 'whatsapp', sync_type: 'history' },
      );
      await this.prisma.whatsappOnboarding.update({
        where: { id: s.id },
        data: {
          historialRequestId: history.request_id,
          estado: 'COMPLETO',
          tokenCifrado: '',
        },
      });
      return { ok: true, phoneNumberId: number.id };
    } catch (error) {
      await this.prisma.whatsappOnboarding.update({
        where: { id: s.id },
        data: { estado: 'ERROR', tokenCifrado: '' },
      });
      throw error;
    }
  }
}
