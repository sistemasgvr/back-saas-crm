import {
  Body,
  Controller,
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
import { SincronizarInsightsCuentaUseCase } from '../application/use-cases/sincronizar-insights-cuenta.use-case';
import { SincronizarInsightsDto } from './dto/sincronizar-insights.dto';

/** Ruta anidada bajo /meta/ad-accounts/:id — controller separado (misma base path
 * que MetaAdAccountsController, sin colisión: :id/insights/sync difiere en profundidad de :id/sync). */
@ApiTags('Meta Insights')
@ApiBearerAuth('JWT-auth')
@Controller('meta/ad-accounts')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, RolesGuard, ModuleGuard)
@Roles('PROPIETARIO', 'ADMINISTRADOR')
@RequireModule('META_LEADS')
export class MetaInsightsController {
  constructor(private readonly sincronizar: SincronizarInsightsCuentaUseCase) {}

  @Post(':id/insights/sync')
  @ApiParam({
    name: 'id',
    description: 'UUID interno de la cuenta publicitaria vinculada',
  })
  @ApiOperation({
    summary: 'Sincronizar insights de una cuenta',
    description:
      'Trae desde Graph API (Marketing Insights) gasto, impresiones, clics y CPL de la cuenta en el rango de fechas dado, para alimentar el dashboard publicitario.',
  })
  @ApiResponse({ status: 201, description: 'Insights sincronizados.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo META_LEADS no activo.',
  })
  @ApiResponse({
    status: 404,
    description: 'La cuenta no existe o no pertenece a la organización.',
  })
  @ApiResponse({
    status: 429,
    description: 'Meta está aplicando rate limiting — reintentar más tarde.',
  })
  sync(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SincronizarInsightsDto,
  ) {
    return this.sincronizar.execute(
      ctx.organizacionId!,
      id,
      { desde: dto.desde, hasta: dto.hasta },
      ctx.usuarioId,
    );
  }
}
