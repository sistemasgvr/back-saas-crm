import {
  Body,
  Controller,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../shared/presentation/guards/platform-admin.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import { ORGANIZACION_MODULOS_ADMIN_REPOSITORY } from '../application/ports/organizacion-modulos-admin.repository.port';
import type { OrganizacionModulosAdminRepository } from '../application/ports/organizacion-modulos-admin.repository.port';
import { ToggleModuloDto } from './dto/toggle-modulo.dto';

@ApiTags('Platform Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin/organizations/:organizacionId/module-groups')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminOrganizationModuleGroupsController {
  constructor(
    @Inject(ORGANIZACION_MODULOS_ADMIN_REPOSITORY)
    private readonly repository: OrganizacionModulosAdminRepository,
  ) {}
  @Patch(':grupoId') async toggle(
    @Param('organizacionId', ParseUUIDPipe) organizacionId: string,
    @Param('grupoId', ParseUUIDPipe) grupoId: string,
    @Body() dto: ToggleModuloDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    await this.repository.toggleGrupo(
      organizacionId,
      grupoId,
      dto.habilitado,
      ctx.usuarioId,
      dto.desactivarDependientes,
    );
    return this.repository.listarMatrizPorOrganizacion(organizacionId);
  }
}
