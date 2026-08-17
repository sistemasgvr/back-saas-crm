import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../../shared/presentation/guards/org-membership.guard';
import { RolesGuard } from '../../../shared/presentation/guards/roles.guard';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import { ModuleGuard } from '../../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../../shared/presentation/decorators/require-module.decorator';
import { ObtenerConexionActualUseCase } from '../application/use-cases/obtener-conexion-actual.use-case';
import { ListarPaginasUseCase } from '../application/use-cases/listar-paginas.use-case';
import { ListarCuentasPublicitariasUseCase } from '../application/use-cases/listar-cuentas-publicitarias.use-case';
import { SeleccionarPaginaUseCase } from '../application/use-cases/seleccionar-pagina.use-case';
import { SeleccionarCuentaPublicitariaUseCase } from '../application/use-cases/seleccionar-cuenta-publicitaria.use-case';
import { DesconectarUseCase } from '../application/use-cases/desconectar.use-case';
import { GuardarCredencialesAppUseCase } from '../application/use-cases/guardar-credenciales-app.use-case';
import { SeleccionarPaginaDto } from './dto/seleccionar-pagina.dto';
import { SeleccionarCuentaDto } from './dto/seleccionar-cuenta.dto';
import { GuardarCredencialesDto } from './dto/guardar-credenciales.dto';

@Controller('meta/connections')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, RolesGuard, ModuleGuard)
@Roles('PROPIETARIO', 'ADMINISTRADOR')
@RequireModule('META_LEADS')
export class MetaConnectionsController {
  constructor(
    private readonly obtenerConexionActual: ObtenerConexionActualUseCase,
    private readonly guardarCredencialesApp: GuardarCredencialesAppUseCase,
    private readonly listarPaginas: ListarPaginasUseCase,
    private readonly listarCuentasPublicitarias: ListarCuentasPublicitariasUseCase,
    private readonly seleccionarPagina: SeleccionarPaginaUseCase,
    private readonly seleccionarCuentaPublicitaria: SeleccionarCuentaPublicitariaUseCase,
    private readonly desconectar: DesconectarUseCase,
  ) {}

  @Get('current')
  getCurrent(@CurrentUser() ctx: RequestContext) {
    return this.obtenerConexionActual.execute(ctx.organizacionId!);
  }

  @Post('app-credentials')
  saveAppCredentials(@CurrentUser() ctx: RequestContext, @Body() dto: GuardarCredencialesDto) {
    return this.guardarCredencialesApp.execute(
      ctx.organizacionId!,
      dto.appId,
      dto.appSecret,
      ctx.usuarioId,
    );
  }

  @Get('pages')
  getPages(@CurrentUser() ctx: RequestContext) {
    return this.listarPaginas.execute(ctx.organizacionId!);
  }

  @Get('ad-accounts')
  getAdAccounts(@CurrentUser() ctx: RequestContext) {
    return this.listarCuentasPublicitarias.execute(ctx.organizacionId!);
  }

  @Post('page')
  selectPage(@CurrentUser() ctx: RequestContext, @Body() dto: SeleccionarPaginaDto) {
    return this.seleccionarPagina.execute(
      ctx.organizacionId!,
      dto.pageId,
      dto.pageNombre,
      ctx.usuarioId,
    );
  }

  @Post('ad-account')
  selectAdAccount(@CurrentUser() ctx: RequestContext, @Body() dto: SeleccionarCuentaDto) {
    return this.seleccionarCuentaPublicitaria.execute(
      ctx.organizacionId!,
      dto.adAccountId,
      dto.adAccountNombre,
      ctx.usuarioId,
    );
  }

  @Post('disconnect')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(@CurrentUser() ctx: RequestContext): Promise<void> {
    await this.desconectar.execute(ctx.organizacionId!, ctx.usuarioId);
  }
}
