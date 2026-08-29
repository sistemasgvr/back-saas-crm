import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../../shared/presentation/guards/org-membership.guard';
import { RolesGuard } from '../../../shared/presentation/guards/roles.guard';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import { ModuleGuard } from '../../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../../shared/presentation/decorators/require-module.decorator';
import { ObtenerUrlOAuthUseCase } from '../application/use-cases/obtener-url-oauth.use-case';
import { ProcesarCallbackOAuthUseCase } from '../application/use-cases/procesar-callback-oauth.use-case';

@ApiTags('Meta Connections')
@Controller('meta/oauth')
export class MetaOAuthController {
  constructor(
    private readonly obtenerUrlOAuth: ObtenerUrlOAuthUseCase,
    private readonly procesarCallbackOAuth: ProcesarCallbackOAuthUseCase,
    private readonly config: ConfigService,
  ) {}

  @Get('url')
  @UseGuards(JwtAuthGuard, OrgMembershipGuard, RolesGuard, ModuleGuard)
  @Roles('PROPIETARIO', 'ADMINISTRADOR')
  @RequireModule('META_LEADS')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener la URL de autorización de Meta',
    description:
      'Genera la URL de OAuth de Meta (con un `state` firmado) a la que se debe redirigir al usuario para ' +
      'conectar o reautorizar la cuenta. `rerequest=1` fuerza a Meta a repreguntar por permisos ya denegados; ' +
      '`features` es una lista separada por comas de features opcionales a solicitar además de los base.',
  })
  @ApiQuery({
    name: 'rerequest',
    required: false,
    description: '"1" para forzar re-solicitud de permisos denegados',
  })
  @ApiQuery({
    name: 'features',
    required: false,
    description:
      'Ids de features opcionales separados por coma, ej. "whatsapp_management"',
  })
  @ApiResponse({ status: 200, description: 'URL de autorización de Meta.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  getUrl(
    @CurrentUser() ctx: RequestContext,
    @Query('rerequest') rerequest?: string,
    @Query('features') features?: string,
  ) {
    const featureIds = features
      ? features
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean)
      : undefined;
    return this.obtenerUrlOAuth.execute(
      ctx.organizacionId!,
      ctx.usuarioId,
      rerequest === '1',
      featureIds,
    );
  }

  // Público: lo invoca el navegador vía redirect de Meta, sin Bearer token.
  // Se autentica a sí mismo verificando la firma del `state` (ver ObtenerUrlOAuthUseCase).
  // Excluido de Swagger: es un destino de redirect de navegador, no un endpoint de API para invocar directo.
  @Get('callback')
  @ApiExcludeEndpoint()
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    try {
      if (!code || !state) {
        throw new Error('Faltan parámetros code/state');
      }
      await this.procesarCallbackOAuth.execute({ code, state });
      res.redirect(`${frontendUrl}/settings/meta?meta=connected`);
    } catch {
      res.redirect(`${frontendUrl}/settings/meta?meta=error`);
    }
  }
}
