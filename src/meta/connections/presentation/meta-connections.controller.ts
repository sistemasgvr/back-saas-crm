import {
  Body,
  Controller,
  Get,
  GoneException,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
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
import { ObtenerConexionActualUseCase } from '../application/use-cases/obtener-conexion-actual.use-case';
import { ListarPaginasUseCase } from '../application/use-cases/listar-paginas.use-case';
import { ListarCuentasPublicitariasUseCase } from '../application/use-cases/listar-cuentas-publicitarias.use-case';
import { DesconectarUseCase } from '../application/use-cases/desconectar.use-case';
import { GuardarCredencialesAppUseCase } from '../application/use-cases/guardar-credenciales-app.use-case';
import { ObtenerSaludPermisosMetaUseCase } from '../application/use-cases/obtener-salud-permisos-meta.use-case';
import { TogglearFeaturePermisoUseCase } from '../application/use-cases/togglear-feature-permiso.use-case';
import { GuardarCredencialesDto } from './dto/guardar-credenciales.dto';
import { PatchFeaturePermisoDto } from './dto/patch-feature-permiso.dto';

@ApiTags('Meta Connections')
@ApiBearerAuth('JWT-auth')
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
    private readonly obtenerSaludPermisos: ObtenerSaludPermisosMetaUseCase,
    private readonly togglearFeature: TogglearFeaturePermisoUseCase,
  ) {}

  @Get('current')
  @ApiOperation({
    summary: 'Estado de la conexión con Meta',
    description:
      'Devuelve si la organización tiene una cuenta de Meta vinculada y sus datos básicos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de la conexión (o null si no hay ninguna).',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  getCurrent(@CurrentUser() ctx: RequestContext) {
    return this.obtenerConexionActual.execute(ctx.organizacionId!);
  }

  @Get('permissions')
  @ApiOperation({
    summary: 'Salud de permisos de Meta',
    description:
      'Compara los scopes otorgados vs. los requeridos/opcionales según la matriz de features, para detectar permisos faltantes o revocados.',
  })
  @ApiResponse({
    status: 200,
    description: 'Matriz de permisos con su estado.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  getPermissions(@CurrentUser() ctx: RequestContext) {
    return this.obtenerSaludPermisos.execute(ctx.organizacionId!);
  }

  @Patch('permissions/features')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Activar/desactivar un feature opcional de Meta',
    description:
      'Ej. activar whatsapp_management pide el scope correspondiente vía reautorización si aún no fue otorgado.',
  })
  @ApiResponse({ status: 204, description: 'Feature actualizado.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  async patchFeature(
    @CurrentUser() ctx: RequestContext,
    @Body() dto: PatchFeaturePermisoDto,
  ): Promise<void> {
    await this.togglearFeature.execute(
      ctx.organizacionId!,
      {
        featureId: dto.featureId,
        deseada: dto.deseada,
        revocarEnMeta: dto.revocarEnMeta,
      },
      ctx.usuarioId,
    );
  }

  @Post('app-credentials')
  @ApiOperation({
    summary: 'Guardar credenciales de la app de Meta',
    description:
      'App ID + App Secret de la app de Meta for Developers propia de la organización (se cifra antes de persistir).',
  })
  @ApiResponse({ status: 200, description: 'Credenciales guardadas.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
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
  @ApiOperation({
    summary: 'Páginas de Facebook disponibles en Meta',
    description:
      'Consulta en vivo a Graph API las páginas administradas por el usuario que autorizó la conexión.',
  })
  @ApiResponse({
    status: 200,
    description: 'Páginas disponibles para vincular.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  getPages(@CurrentUser() ctx: RequestContext) {
    return this.listarPaginas.execute(ctx.organizacionId!);
  }

  @Get('ad-accounts')
  @ApiOperation({
    summary: 'Cuentas publicitarias disponibles en Meta',
    description:
      'Consulta en vivo a Graph API las cuentas publicitarias accesibles con la conexión actual.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cuentas publicitarias disponibles para vincular.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  getAdAccounts(@CurrentUser() ctx: RequestContext) {
    return this.listarCuentasPublicitarias.execute(ctx.organizacionId!);
  }

  /** @deprecated Fase 13 — usar POST /meta/pages (soporta N páginas por org). */
  @Post('page')
  @ApiOperation({
    summary: '[Obsoleto] Seleccionar página',
    deprecated: true,
    description:
      'Reemplazado por POST /meta/pages, que soporta varias páginas por organización.',
  })
  @ApiResponse({
    status: 410,
    description: 'Siempre devuelve 410 Gone — usar POST /meta/pages.',
  })
  selectPage(): never {
    throw new GoneException(
      'Usa POST /meta/pages — esta organización ahora puede vincular varias páginas.',
    );
  }

  /** @deprecated Fase 13 — usar POST /meta/ad-accounts (soporta N cuentas por org). */
  @Post('ad-account')
  @ApiOperation({
    summary: '[Obsoleto] Seleccionar cuenta publicitaria',
    deprecated: true,
    description:
      'Reemplazado por POST /meta/ad-accounts, que soporta varias cuentas por organización.',
  })
  @ApiResponse({
    status: 410,
    description: 'Siempre devuelve 410 Gone — usar POST /meta/ad-accounts.',
  })
  selectAdAccount(): never {
    throw new GoneException(
      'Usa POST /meta/ad-accounts — esta organización ahora puede vincular varias cuentas.',
    );
  }

  @Post('disconnect')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Desconectar la cuenta de Meta',
    description:
      'Elimina la conexión y todas las páginas/cuentas vinculadas de la organización.',
  })
  @ApiResponse({ status: 204, description: 'Cuenta desconectada.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  async disconnect(@CurrentUser() ctx: RequestContext): Promise<void> {
    await this.desconectar.execute(ctx.organizacionId!, ctx.usuarioId);
  }
}
