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
import { ListarCuentasVinculadasUseCase } from '../application/use-cases/listar-cuentas-vinculadas.use-case';
import { ListarCuentasDisponiblesUseCase } from '../application/use-cases/listar-cuentas-disponibles.use-case';
import { ObtenerPerfilCuentaUseCase } from '../application/use-cases/obtener-perfil-cuenta.use-case';
import { VincularCuentaUseCase } from '../application/use-cases/vincular-cuenta.use-case';
import { DesvincularCuentaUseCase } from '../application/use-cases/desvincular-cuenta.use-case';
import { SincronizarCuentaUseCase } from '../application/use-cases/sincronizar-cuenta.use-case';
import { ListarCuentasFiltroUseCase } from '../application/use-cases/listar-cuentas-filtro.use-case';
import { VincularCuentaDto } from './dto/vincular-cuenta.dto';

@ApiTags('Meta Ad Accounts')
@ApiBearerAuth('JWT-auth')
@Controller('meta/ad-accounts')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, RolesGuard, ModuleGuard)
@Roles('PROPIETARIO', 'ADMINISTRADOR')
@RequireModule('META_LEADS')
export class MetaAdAccountsController {
  constructor(
    private readonly listarVinculadas: ListarCuentasVinculadasUseCase,
    private readonly listarDisponibles: ListarCuentasDisponiblesUseCase,
    private readonly obtenerPerfil: ObtenerPerfilCuentaUseCase,
    private readonly vincular: VincularCuentaUseCase,
    private readonly desvincular: DesvincularCuentaUseCase,
    private readonly sincronizar: SincronizarCuentaUseCase,
    private readonly listarFiltro: ListarCuentasFiltroUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar cuentas publicitarias vinculadas',
    description:
      'Cuentas de Meta Ads ya vinculadas a la organización (paginado).',
  })
  @ApiResponse({ status: 200, description: 'Página de cuentas vinculadas.' })
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
    summary: 'Cuentas publicitarias disponibles para vincular',
    description:
      'Consulta en vivo a Graph API las cuentas accesibles que aún no están vinculadas.',
  })
  @ApiResponse({ status: 200, description: 'Cuentas disponibles.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  findAvailable(@CurrentUser() ctx: RequestContext) {
    return this.listarDisponibles.execute(ctx.organizacionId!);
  }

  /** Sin restricción de rol — cualquier miembro con el módulo puede poblar el filtro de /dashboard. */
  @Get('filtro')
  @Roles()
  @ApiOperation({
    summary: 'Cuentas para poblar el filtro del dashboard',
    description:
      'Lista liviana (id + nombre), accesible a cualquier rol con el módulo activo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cuentas para el selector de filtro.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({ status: 403, description: 'Módulo META_LEADS no activo.' })
  findFiltro(@CurrentUser() ctx: RequestContext) {
    return this.listarFiltro.execute(ctx.organizacionId!);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener el perfil de una cuenta publicitaria vinculada',
  })
  @ApiResponse({ status: 200, description: 'Perfil de la cuenta.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  @ApiResponse({
    status: 404,
    description: 'La cuenta no existe o no pertenece a la organización.',
  })
  findOne(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.obtenerPerfil.execute(ctx.organizacionId!, id);
  }

  @Post()
  @ApiOperation({ summary: 'Vincular una cuenta publicitaria' })
  @ApiResponse({ status: 201, description: 'Cuenta vinculada.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  create(@CurrentUser() ctx: RequestContext, @Body() dto: VincularCuentaDto) {
    return this.vincular.execute(
      ctx.organizacionId!,
      dto.adAccountId,
      dto.adAccountNombre,
      ctx.usuarioId,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desvincular una cuenta publicitaria' })
  @ApiResponse({ status: 204, description: 'Cuenta desvinculada.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  @ApiResponse({
    status: 404,
    description: 'La cuenta no existe o no pertenece a la organización.',
  })
  async remove(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.desvincular.execute(ctx.organizacionId!, id, ctx.usuarioId);
  }

  @Post(':id/sync')
  @ApiOperation({
    summary: 'Sincronizar campañas/conjuntos/anuncios de la cuenta',
    description:
      'Trae desde Graph API las campañas, conjuntos de anuncios y anuncios de la cuenta.',
  })
  @ApiResponse({ status: 201, description: 'Sincronización completada.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  @ApiResponse({
    status: 404,
    description: 'La cuenta no existe o no pertenece a la organización.',
  })
  sync(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sincronizar.execute(ctx.organizacionId!, id, ctx.usuarioId);
  }
}
