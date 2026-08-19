import {
  Body,
  Controller,
  Get,
  GoneException,
  HttpCode,
  HttpStatus,
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
import { ObtenerConexionActualUseCase } from '../application/use-cases/obtener-conexion-actual.use-case';
import { ListarPaginasUseCase } from '../application/use-cases/listar-paginas.use-case';
import { ListarCuentasPublicitariasUseCase } from '../application/use-cases/listar-cuentas-publicitarias.use-case';
import { DesconectarUseCase } from '../application/use-cases/desconectar.use-case';
import { GuardarCredencialesAppUseCase } from '../application/use-cases/guardar-credenciales-app.use-case';
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
    private readonly desconectar: DesconectarUseCase,
  ) {}

  @Get('current')
  getCurrent(@CurrentUser() ctx: RequestContext) {
    return this.obtenerConexionActual.execute(ctx.organizacionId!);
  }

  @Post('app-credentials')
  saveAppCredentials(
    @CurrentUser() ctx: RequestContext,
    @Body() dto: GuardarCredencialesDto,
  ) {
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

  /** @deprecated Fase 13 — usar POST /meta/pages (soporta N páginas por org). */
  @Post('page')
  selectPage(): never {
    throw new GoneException(
      'Usa POST /meta/pages — esta organización ahora puede vincular varias páginas.',
    );
  }

  /** @deprecated Fase 13 — usar POST /meta/ad-accounts (soporta N cuentas por org). */
  @Post('ad-account')
  selectAdAccount(): never {
    throw new GoneException(
      'Usa POST /meta/ad-accounts — esta organización ahora puede vincular varias cuentas.',
    );
  }

  @Post('disconnect')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(@CurrentUser() ctx: RequestContext): Promise<void> {
    await this.desconectar.execute(ctx.organizacionId!, ctx.usuarioId);
  }
}
