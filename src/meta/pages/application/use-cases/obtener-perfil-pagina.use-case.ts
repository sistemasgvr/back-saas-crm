import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { META_PAGINAS_REPOSITORY } from '../ports/meta-paginas.repository.port';
import type { MetaPaginasRepository } from '../ports/meta-paginas.repository.port';

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class ObtenerPerfilPaginaUseCase {
  constructor(
    @Inject(META_PAGINAS_REPOSITORY)
    private readonly paginas: MetaPaginasRepository,
  ) {}

  async execute(organizacionId: string, id: string) {
    const pagina = await this.paginas.findPorId(organizacionId, id);
    if (!pagina) {
      throw new NotFoundException('Página no encontrada');
    }

    const [totalLeads, leadsUltimos7Dias] = await Promise.all([
      this.paginas.contarLeadsTotal(pagina.id),
      this.paginas.contarLeadsDesde(
        pagina.id,
        new Date(Date.now() - SIETE_DIAS_MS),
      ),
    ]);

    return { ...pagina, totalLeads, leadsUltimos7Dias };
  }
}
