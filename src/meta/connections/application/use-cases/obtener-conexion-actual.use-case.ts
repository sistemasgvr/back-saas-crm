import { Inject, Injectable } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../ports/meta-conexiones.repository.port';
import { META_PAGINAS_REPOSITORY } from '../../../pages/application/ports/meta-paginas.repository.port';
import type { MetaPaginasRepository } from '../../../pages/application/ports/meta-paginas.repository.port';
import { META_CUENTAS_PUBLICITARIAS_REPOSITORY } from '../../../ad-accounts/application/ports/meta-cuentas-publicitarias.repository.port';
import type { MetaCuentasPublicitariasRepository } from '../../../ad-accounts/application/ports/meta-cuentas-publicitarias.repository.port';
import { toConexionResponse } from '../conexion-response.mapper';

@Injectable()
export class ObtenerConexionActualUseCase {
  constructor(
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(META_PAGINAS_REPOSITORY)
    private readonly paginas: MetaPaginasRepository,
    @Inject(META_CUENTAS_PUBLICITARIAS_REPOSITORY)
    private readonly cuentas: MetaCuentasPublicitariasRepository,
  ) {}

  async execute(organizacionId: string) {
    const conexion =
      await this.conexiones.findActivaPorOrganizacion(organizacionId);
    if (!conexion) return toConexionResponse(null, 0, 0);

    const [paginasActivas, cuentasActivas] = await Promise.all([
      this.paginas.contarActivasPorOrganizacion(organizacionId),
      this.cuentas.contarActivasPorOrganizacion(organizacionId),
    ]);

    return toConexionResponse(conexion, paginasActivas, cuentasActivas);
  }
}
