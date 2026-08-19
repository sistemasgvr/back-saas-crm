import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { META_CUENTAS_PUBLICITARIAS_REPOSITORY } from '../ports/meta-cuentas-publicitarias.repository.port';
import type { MetaCuentasPublicitariasRepository } from '../ports/meta-cuentas-publicitarias.repository.port';

@Injectable()
export class VincularCuentaUseCase {
  constructor(
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(META_CUENTAS_PUBLICITARIAS_REPOSITORY)
    private readonly cuentas: MetaCuentasPublicitariasRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(
    organizacionId: string,
    adAccountId: string,
    adAccountNombre: string,
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
    const detalle = await this.graph.obtenerCuentaPublicitaria(
      adAccountId,
      accessToken,
    );

    return this.cuentas.vincular({
      organizacionId,
      metaConexionId: conexion.id,
      adAccountId,
      nombre: detalle?.nombre ?? adAccountNombre,
      moneda: detalle?.moneda,
      estadoCuenta: detalle?.estadoCuenta,
      timezone: detalle?.timezone,
      usuarioEdicion,
    });
  }
}
