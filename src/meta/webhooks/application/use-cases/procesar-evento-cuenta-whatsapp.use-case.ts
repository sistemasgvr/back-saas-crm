import { Inject, Injectable, Logger } from '@nestjs/common';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../../whatsapp/connections/application/ports/whatsapp-conexiones.repository.port';
import type {
  WhatsappConexionesRepository,
  WhatsappConexionRow,
} from '../../../../whatsapp/connections/application/ports/whatsapp-conexiones.repository.port';
import { CrearNotificacionUseCase } from '../../../../notifications/application/use-cases/crear-notificacion.use-case';
import type { EventoCuentaWhatsApp } from '../../domain/whatsapp-webhook-cuenta';

const soloDigitos = (valor: string | null | undefined) =>
  (valor ?? '').replace(/\D/g, '');

/**
 * Eventos de cuenta del webhook WhatsApp (account_update, plantillas,
 * alertas, seguridad, nombre/calidad del número…): actualiza el estado de la
 * línea cuando Meta lo informa (p. ej. coexistencia desconectada) y avisa a
 * PROPIETARIO/ADMINISTRADOR de la org dueña de la línea.
 */
@Injectable()
export class ProcesarEventoCuentaWhatsAppUseCase {
  private readonly logger = new Logger(
    ProcesarEventoCuentaWhatsAppUseCase.name,
  );

  constructor(
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly conexiones: WhatsappConexionesRepository,
    private readonly crearNotificacion: CrearNotificacionUseCase,
  ) {}

  async execute(evento: EventoCuentaWhatsApp): Promise<void> {
    const lineas = await this.resolverLineas(evento);
    this.logger.log(
      `Webhook WhatsApp ${evento.campo}/${evento.evento ?? '-'} (${evento.severidad}) → ${lineas.length} línea(s)`,
    );
    if (lineas.length === 0) return;

    if (evento.cambiosLinea) {
      for (const linea of lineas) {
        await this.conexiones.actualizarDatosMeta(
          linea.id,
          evento.cambiosLinea,
        );
      }
    }

    if (!evento.notificar) return;
    // Un WABA puede estar vinculado en más de una org: un aviso por org.
    const porOrg = new Map<string, WhatsappConexionRow>();
    for (const linea of lineas) {
      if (!porOrg.has(linea.organizacionId)) {
        porOrg.set(linea.organizacionId, linea);
      }
    }
    for (const [organizacionId, linea] of porOrg) {
      await this.crearNotificacion.execute({
        organizacionId,
        tipo: 'WHATSAPP_CUENTA',
        titulo: evento.titulo,
        mensaje: evento.mensaje,
        payload: {
          url: '/settings/whatsapp',
          whatsappConexionId: linea.id,
          campo: evento.campo,
          evento: evento.evento,
          severidad: evento.severidad,
        },
        roles: ['PROPIETARIO', 'ADMINISTRADOR'],
      });
    }
  }

  /** phone_number_id del evento → esa línea. Si solo trae el WABA (entry.id),
   * las líneas de ese WABA, filtradas por número visible cuando Meta lo manda. */
  private async resolverLineas(
    evento: EventoCuentaWhatsApp,
  ): Promise<WhatsappConexionRow[]> {
    if (evento.phoneNumberId) {
      const linea = await this.conexiones.findPorPhoneNumberId(
        evento.phoneNumberId,
      );
      // Número de Meta que no está vinculado al CRM: no es de ninguna línea.
      return linea ? [linea] : [];
    }
    if (!evento.wabaId) return [];
    const lineas = await this.conexiones.listarPorWabaId(evento.wabaId);
    const numero = soloDigitos(evento.numeroDisplay);
    if (!numero) return lineas;
    // Con número explícito, solo esa línea: otro número del mismo WABA que no
    // está vinculado al CRM no debe marcar ni avisar sobre las demás.
    return lineas.filter((linea) => {
      const display = soloDigitos(linea.numeroDisplay);
      return (
        display.length > 0 &&
        (display.endsWith(numero) || numero.endsWith(display))
      );
    });
  }
}
