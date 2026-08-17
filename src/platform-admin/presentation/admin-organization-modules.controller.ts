import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../shared/presentation/guards/platform-admin.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import { ListarMatrizModulosOrganizacionUseCase } from '../application/use-cases/listar-matriz-modulos-organizacion.use-case';
import { ToggleModuloOrganizacionUseCase } from '../application/use-cases/toggle-modulo-organizacion.use-case';
import { ToggleModuloDto } from './dto/toggle-modulo.dto';

@Controller('admin/organizations/:organizacionId/modules')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminOrganizationModulesController {
  constructor(
    private readonly listarMatriz: ListarMatrizModulosOrganizacionUseCase,
    private readonly toggleModulo: ToggleModuloOrganizacionUseCase,
  ) {}

  @Get()
  findAll(@Param('organizacionId', ParseUUIDPipe) organizacionId: string) {
    return this.listarMatriz.execute(organizacionId);
  }

  @Patch(':moduloId')
  toggle(
    @Param('organizacionId', ParseUUIDPipe) organizacionId: string,
    @Param('moduloId', ParseUUIDPipe) moduloId: string,
    @Body() dto: ToggleModuloDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.toggleModulo.execute(organizacionId, moduloId, dto.habilitado, ctx.usuarioId);
  }
}
