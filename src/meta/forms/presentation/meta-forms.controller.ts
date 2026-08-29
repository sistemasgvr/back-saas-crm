import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../../shared/presentation/guards/org-membership.guard';
import { ModuleGuard } from '../../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../../shared/presentation/decorators/require-module.decorator';
import { ListarFormulariosFiltroUseCase } from '../application/use-cases/listar-formularios-filtro.use-case';

/** Lectura mínima sin restricción de rol — poblar el filtro de /leads por formulario (Fase 14.2). */
@ApiTags('Meta Forms')
@ApiBearerAuth('JWT-auth')
@Controller('meta/forms')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, ModuleGuard)
@RequireModule('META_LEADS')
export class MetaFormsController {
  constructor(private readonly listarFiltro: ListarFormulariosFiltroUseCase) {}

  @Get()
  @ApiOperation({
    summary: 'Formularios para poblar el filtro de leads',
    description:
      'Lista liviana (id + nombre) de todos los formularios sincronizados, opcionalmente acotada a una página.',
  })
  @ApiQuery({
    name: 'metaPaginaId',
    required: false,
    description: 'UUID interno de la página, para acotar el listado',
  })
  @ApiResponse({
    status: 200,
    description: 'Formularios para el selector de filtro.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({ status: 403, description: 'Módulo META_LEADS no activo.' })
  findAll(
    @CurrentUser() ctx: RequestContext,
    @Query('metaPaginaId') metaPaginaId?: string,
  ) {
    return this.listarFiltro.execute(ctx.organizacionId!, metaPaginaId);
  }
}
