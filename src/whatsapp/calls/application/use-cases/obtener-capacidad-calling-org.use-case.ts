import { Inject, Injectable } from '@nestjs/common';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import { conexionPuedeCalling } from '../../../connections/domain/rol-linea-whatsapp';
import { ObtenerIceServersUseCase } from './obtener-ice-servers.use-case';

@Injectable()
export class ObtenerCapacidadCallingOrgUseCase {
  constructor(
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly conexionesWa: WhatsappConexionesRepository,
    private readonly iceServers: ObtenerIceServersUseCase,
  ) {}

  async execute(organizacionId: string) {
    const conexiones =
      await this.conexionesWa.listarPorOrganizacion(organizacionId);
    const calling = conexiones.find((c) =>
      conexionPuedeCalling({
        rolLinea: c.rolLinea,
        callingHabilitado: c.callingHabilitado ? 1 : 0,
      }),
    );
    const candidata =
      calling ??
      conexiones.find(
        (c) => c.rolLinea === 'LLAMADAS' || c.rolLinea === 'AMBOS',
      );

    const ice = this.iceServers.execute();

    return {
      tieneLineaCalling: !!candidata,
      callingHabilitado: candidata?.callingHabilitado ?? false,
      conexion: candidata
        ? {
            id: candidata.id,
            phoneNumberId: candidata.phoneNumberId,
            numeroDisplay: candidata.numeroDisplay,
            nombreVerificado: candidata.nombreVerificado,
            rolLinea: candidata.rolLinea,
            callingHabilitado: candidata.callingHabilitado,
            callingUltimoError: candidata.callingUltimoError,
          }
        : null,
      iceReady: ice.ready,
      saludable:
        !!candidata?.callingHabilitado &&
        ice.ready &&
        !candidata.callingUltimoError,
    };
  }
}
