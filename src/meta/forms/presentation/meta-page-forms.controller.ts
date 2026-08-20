import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../../shared/presentation/guards/org-membership.guard';
import { RolesGuard } from '../../../shared/presentation/guards/roles.guard';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import { ModuleGuard } from '../../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../../shared/presentation/decorators/require-module.decorator';
import {
  inicioDiaLimaUtc,
  finDiaLimaUtc,
} from '../../../shared/application/lima-time';
import { BackfillLeadsFormularioUseCase } from '../../leads/application/use-cases/backfill-leads-formulario.use-case';
import { ListarFormulariosPaginaUseCase } from '../application/use-cases/listar-formularios-pagina.use-case';
import { SincronizarFormulariosPaginaUseCase } from '../application/use-cases/sincronizar-formularios-pagina.use-case';
import { BackfillLeadsDto } from './dto/backfill-leads.dto';

/** Rutas anidadas bajo /meta/pages/:id — controller separado (misma base path,
 * sin colisión de rutas con MetaPagesController: :id vs :id/forms difieren en profundidad). */
@Controller('meta/pages')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, RolesGuard, ModuleGuard)
@Roles('PROPIETARIO', 'ADMINISTRADOR')
@RequireModule('META_LEADS')
export class MetaPageFormsController {
  constructor(
    private readonly listarPorPagina: ListarFormulariosPaginaUseCase,
    private readonly sincronizar: SincronizarFormulariosPaginaUseCase,
    private readonly backfill: BackfillLeadsFormularioUseCase,
  ) {}

  @Get(':id/forms')
  findAll(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listarPorPagina.execute(ctx.organizacionId!, id);
  }

  @Post(':id/forms/sync')
  sync(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sincronizar.execute(ctx.organizacionId!, id, ctx.usuarioId);
  }

  @Post(':id/forms/:formId/backfill')
  backfillLeads(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('formId') formId: string,
    @Body() dto: BackfillLeadsDto,
  ) {
    return this.backfill.execute(ctx.organizacionId!, id, formId, {
      desde: dto.desde ? inicioDiaLimaUtc(dto.desde) : undefined,
      hasta: dto.hasta ? finDiaLimaUtc(dto.hasta) : undefined,
      cursor: dto.cursor,
    });
  }
}
