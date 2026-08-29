import { Controller, Get, UseGuards } from '@nestjs/common';
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
import { ModuleGuard } from '../../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../../shared/presentation/decorators/require-module.decorator';
import { ListarCampanasUseCase } from '../application/use-cases/listar-campanas.use-case';

// Lectura mínima para poblar filtros de /leads y /dashboard (Fase 10-11).
// El poblado de estas tablas ocurre desde el webhook de leads (Fase 9).
@ApiTags('Meta Campaigns')
@ApiBearerAuth('JWT-auth')
@Controller('meta/campaigns')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, ModuleGuard)
@RequireModule('META_LEADS')
export class CampaignsController {
  constructor(private readonly listarCampanas: ListarCampanasUseCase) {}

  @Get()
  @ApiOperation({
    summary: 'Listar campañas',
    description:
      'Campañas de Meta conocidas por la organización (pobladas automáticamente desde los leads entrantes), para poblar filtros.',
  })
  @ApiResponse({ status: 200, description: 'Campañas de la organización.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({ status: 403, description: 'Módulo META_LEADS no activo.' })
  findAll(@CurrentUser() ctx: RequestContext) {
    return this.listarCampanas.execute(ctx.organizacionId!);
  }
}
