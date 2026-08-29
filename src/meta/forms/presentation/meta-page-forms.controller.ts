import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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
import { ContarLeadsMetaPaginaUseCase } from '../application/use-cases/contar-leads-meta-pagina.use-case';
import { BackfillLeadsDto } from './dto/backfill-leads.dto';

/** Rutas anidadas bajo /meta/pages/:id — controller separado (misma base path,
 * sin colisión de rutas con MetaPagesController: :id vs :id/forms difieren en profundidad). */
@ApiTags('Meta Forms')
@ApiBearerAuth('JWT-auth')
@Controller('meta/pages')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, RolesGuard, ModuleGuard)
@Roles('PROPIETARIO', 'ADMINISTRADOR')
@RequireModule('META_LEADS')
export class MetaPageFormsController {
  constructor(
    private readonly listarPorPagina: ListarFormulariosPaginaUseCase,
    private readonly sincronizar: SincronizarFormulariosPaginaUseCase,
    private readonly backfill: BackfillLeadsFormularioUseCase,
    private readonly contarLeadsMeta: ContarLeadsMetaPaginaUseCase,
  ) {}

  @Get(':id/forms')
  @ApiParam({ name: 'id', description: 'UUID interno de la página vinculada' })
  @ApiOperation({
    summary: 'Listar formularios de una página',
    description:
      'Formularios de Lead Ads sincronizados para esta página, con el conteo local de leads por formulario.',
  })
  @ApiResponse({ status: 200, description: 'Formularios de la página.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  @ApiResponse({
    status: 404,
    description: 'La página no existe o no pertenece a la organización.',
  })
  findAll(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listarPorPagina.execute(ctx.organizacionId!, id);
  }

  @Post(':id/forms/sync')
  @ApiParam({ name: 'id', description: 'UUID interno de la página vinculada' })
  @ApiOperation({
    summary: 'Sincronizar formularios de una página',
    description:
      'Trae desde Graph API los formularios de Lead Ads de la página y los guarda/actualiza localmente.',
  })
  @ApiResponse({ status: 201, description: 'Formularios sincronizados.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description:
      'Rol insuficiente, módulo META_LEADS no activo, o falta el permiso pages_manage_ads.',
  })
  @ApiResponse({
    status: 404,
    description: 'La página no existe o no pertenece a la organización.',
  })
  @ApiResponse({
    status: 429,
    description: 'Meta está aplicando rate limiting — reintentar más tarde.',
  })
  sync(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sincronizar.execute(ctx.organizacionId!, id, ctx.usuarioId);
  }

  /** Bajo demanda — el usuario lo pide explícitamente para comparar contra
   * Meta (POST porque golpea Graph API, un form por vez, cuesta cuota). */
  @Post(':id/forms/meta-counts')
  @ApiParam({ name: 'id', description: 'UUID interno de la página vinculada' })
  @ApiOperation({
    summary: 'Contar leads reales en Meta por formulario',
    description:
      'Consulta a Graph API (`leads_count`) el total real de leads de cada formulario de la página, para ' +
      'comparar contra el conteo local y detectar leads faltantes. Se pide bajo demanda porque consume cuota.',
  })
  @ApiResponse({ status: 201, description: 'Conteos por formulario.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  @ApiResponse({
    status: 404,
    description: 'La página no existe o no pertenece a la organización.',
  })
  @ApiResponse({
    status: 429,
    description: 'Meta está aplicando rate limiting — reintentar más tarde.',
  })
  contarEnMeta(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contarLeadsMeta.execute(ctx.organizacionId!, id);
  }

  @Post(':id/forms/:formId/backfill')
  @ApiParam({ name: 'id', description: 'UUID interno de la página vinculada' })
  @ApiParam({
    name: 'formId',
    description: 'Id del formulario en Meta (no es UUID interno)',
  })
  @ApiOperation({
    summary: 'Reimportar leads históricos de un formulario',
    description:
      'Trae desde Graph API los leads del formulario en el rango de fechas dado (o todos, sin rango) y los ' +
      'importa a la BD local, saltando los que ya existen. Soporta reanudar con `cursor` para lotes grandes.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Resultado del backfill: importados, ya existentes, errores y el cursor para continuar si quedó incompleto.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  @ApiResponse({
    status: 404,
    description: 'La página o el formulario no existen.',
  })
  @ApiResponse({
    status: 429,
    description: 'Meta está aplicando rate limiting — reintentar más tarde.',
  })
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
