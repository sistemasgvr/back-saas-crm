import { Inject, Injectable, Logger } from '@nestjs/common';
import { BackfillLeadsFormularioUseCase } from '../../../leads/application/use-cases/backfill-leads-formulario.use-case';
import { META_FORMULARIOS_REPOSITORY } from '../ports/meta-formularios.repository.port';
import type { MetaFormulariosRepository } from '../ports/meta-formularios.repository.port';

/** Tope por request HTTP (sin cola): evita timeouts al reimportar muchas forms. */
const MAX_FORMULARIOS_POR_SYNC = 15;

export interface ResultadoSyncLeadsOrganizacion {
  formulariosProcesados: number;
  formulariosOmitidos: number;
  importados: number;
  yaExistian: number;
  errores: number;
  incompleto: boolean;
}

@Injectable()
export class SincronizarLeadsOrganizacionUseCase {
  private readonly logger = new Logger(
    SincronizarLeadsOrganizacionUseCase.name,
  );

  constructor(
    @Inject(META_FORMULARIOS_REPOSITORY)
    private readonly formularios: MetaFormulariosRepository,
    private readonly backfill: BackfillLeadsFormularioUseCase,
  ) {}

  async execute(
    organizacionId: string,
  ): Promise<ResultadoSyncLeadsOrganizacion> {
    const todos =
      await this.formularios.listarActivosParaBackfill(organizacionId);
    const aProcesar = todos.slice(0, MAX_FORMULARIOS_POR_SYNC);
    const formulariosOmitidos = Math.max(0, todos.length - aProcesar.length);

    let importados = 0;
    let yaExistian = 0;
    let errores = 0;
    let incompleto = formulariosOmitidos > 0;
    // Compartido entre formularios: muchos leads de distintas forms de una
    // misma página apuntan a las mismas campañas/conjuntos/anuncios.
    const cacheNombres = new Map<string, string | null>();

    for (const form of aProcesar) {
      try {
        const resultado = await this.backfill.execute(
          organizacionId,
          form.metaPaginaId,
          form.formId,
          {},
          cacheNombres,
        );
        importados += resultado.importados;
        yaExistian += resultado.yaExistian;
        errores += resultado.errores;
        if (resultado.incompleto) incompleto = true;
      } catch (error) {
        errores += 1;
        this.logger.warn(
          `Sync leads org: falló form ${form.formId} (${form.nombre})`,
          error instanceof Error ? error.stack : error,
        );
      }
    }

    return {
      formulariosProcesados: aProcesar.length,
      formulariosOmitidos,
      importados,
      yaExistian,
      errores,
      incompleto,
    };
  }
}
