import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
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
import { PaginacionQueryDto } from '../../../shared/presentation/dto/paginacion.query.dto';
import { ListarPaginasVinculadasUseCase } from '../application/use-cases/listar-paginas-vinculadas.use-case';
import { ListarPaginasDisponiblesUseCase } from '../application/use-cases/listar-paginas-disponibles.use-case';
import { ObtenerPerfilPaginaUseCase } from '../application/use-cases/obtener-perfil-pagina.use-case';
import { VincularPaginaUseCase } from '../application/use-cases/vincular-pagina.use-case';
import { DesvincularPaginaUseCase } from '../application/use-cases/desvincular-pagina.use-case';
import { ResuscribirWebhookPaginaUseCase } from '../application/use-cases/resuscribir-webhook-pagina.use-case';
import { ListarPaginasFiltroUseCase } from '../application/use-cases/listar-paginas-filtro.use-case';
import { VerificarSaludWebhookPaginaUseCase } from '../application/use-cases/verificar-salud-webhook-pagina.use-case';
import { VincularPaginaDto } from './dto/vincular-pagina.dto';

@ApiTags('Meta Pages')
@ApiBearerAuth('JWT-auth')
@Controller('meta/pages')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, RolesGuard, ModuleGuard)
@Roles('PROPIETARIO', 'ADMINISTRADOR')
@RequireModule('META_LEADS')
export class MetaPagesController {
  constructor(
    private readonly listarVinculadas: ListarPaginasVinculadasUseCase,
    private readonly listarDisponibles: ListarPaginasDisponiblesUseCase,
    private readonly obtenerPerfil: ObtenerPerfilPaginaUseCase,
    private readonly vincular: VincularPaginaUseCase,
    private readonly desvincular: DesvincularPaginaUseCase,
    private readonly resuscribirWebhook: ResuscribirWebhookPaginaUseCase,
    private readonly listarFiltro: ListarPaginasFiltroUseCase,
    private readonly verificarSalud: VerificarSaludWebhookPaginaUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar páginas vinculadas',
    description:
      'Páginas de Facebook ya vinculadas a la organización (paginado).',
  })
  @ApiResponse({ status: 200, description: 'Página de páginas vinculadas.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  findAll(
    @CurrentUser() ctx: RequestContext,
    @Query() query: PaginacionQueryDto,
  ) {
    return this.listarVinculadas.execute(
      ctx.organizacionId!,
      query.page,
      query.pageSize,
    );
  }

  @Get('available')
  @ApiOperation({
    summary: 'Páginas disponibles para vincular',
    description:
      'Consulta en vivo a Graph API las páginas administradas por el usuario que aún no están vinculadas.',
  })
  @ApiResponse({ status: 200, description: 'Páginas disponibles.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  findAvailable(@CurrentUser() ctx: RequestContext) {
    return this.listarDisponibles.execute(ctx.organizacionId!);
  }

  /** Sin restricción de rol — cualquier miembro con el módulo puede poblar el filtro de /leads. */
  @Get('filtro')
  @Roles()
  @ApiOperation({
    summary: 'Páginas para poblar el filtro de leads',
    description:
      'Lista liviana (id + nombre), accesible a cualquier rol con el módulo activo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Páginas para el selector de filtro.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({ status: 403, description: 'Módulo META_LEADS no activo.' })
  findFiltro(@CurrentUser() ctx: RequestContext) {
    return this.listarFiltro.execute(ctx.organizacionId!);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener el perfil de una página vinculada' })
  @ApiResponse({ status: 200, description: 'Perfil de la página.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  @ApiResponse({
    status: 404,
    description: 'La página no existe o no pertenece a la organización.',
  })
  findOne(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.obtenerPerfil.execute(ctx.organizacionId!, id);
  }

  @Post()
  @ApiOperation({
    summary: 'Vincular una página',
    description:
      'Suscribe la página al webhook de leadgen de Meta y la guarda como vinculada.',
  })
  @ApiResponse({ status: 201, description: 'Página vinculada.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  create(@CurrentUser() ctx: RequestContext, @Body() dto: VincularPaginaDto) {
    return this.vincular.execute(
      ctx.organizacionId!,
      dto.pageId,
      dto.pageNombre,
      ctx.usuarioId,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desvincular una página' })
  @ApiResponse({ status: 204, description: 'Página desvinculada.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  @ApiResponse({
    status: 404,
    description: 'La página no existe o no pertenece a la organización.',
  })
  async remove(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.desvincular.execute(ctx.organizacionId!, id, ctx.usuarioId);
  }

  @Post(':id/resync-webhook')
  @ApiOperation({
    summary: 'Resuscribir el webhook de la página',
    description:
      'Vuelve a suscribir la página al webhook de leadgen en Meta (útil si dejó de recibir leads).',
  })
  @ApiResponse({ status: 200, description: 'Webhook resuscrito.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  @ApiResponse({
    status: 404,
    description: 'La página no existe o no pertenece a la organización.',
  })
  resyncWebhook(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.resuscribirWebhook.execute(
      ctx.organizacionId!,
      id,
      ctx.usuarioId,
    );
  }

  @Post(':id/health-check')
  @ApiOperation({
    summary: 'Verificar salud del webhook de la página',
    description:
      'Chequea contra Meta que la suscripción al webhook de leadgen siga activa.',
  })
  @ApiResponse({ status: 200, description: 'Resultado del chequeo de salud.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  @ApiResponse({
    status: 404,
    description: 'La página no existe o no pertenece a la organización.',
  })
  healthCheck(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.verificarSalud.execute(ctx.organizacionId!, id, ctx.usuarioId);
  }
}
