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
  findAvailable(@CurrentUser() ctx: RequestContext) {
    return this.listarDisponibles.execute(ctx.organizacionId!);
  }

  /** Sin restricción de rol — cualquier miembro con el módulo puede poblar el filtro de /dashboard. */
  @Get('filtro')
  @Roles()
  findFiltro(@CurrentUser() ctx: RequestContext) {
    return this.listarFiltro.execute(ctx.organizacionId!);
  }

  @Get(':id')
  findOne(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.obtenerPerfil.execute(ctx.organizacionId!, id);
  }

  @Post()
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
  async remove(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.desvincular.execute(ctx.organizacionId!, id, ctx.usuarioId);
  }

  @Post(':id/sync')
  sync(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sincronizar.execute(ctx.organizacionId!, id, ctx.usuarioId);
  }
}
