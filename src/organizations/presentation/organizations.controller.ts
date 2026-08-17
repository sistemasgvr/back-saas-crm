import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../shared/presentation/guards/org-membership.guard';
import { RolesGuard } from '../../shared/presentation/guards/roles.guard';
import { Roles } from '../../shared/presentation/decorators/roles.decorator';
import { GetOrganizacionActualUseCase } from '../application/use-cases/get-organizacion-actual.use-case';
import { ActualizarOrganizacionActualUseCase } from '../application/use-cases/actualizar-organizacion-actual.use-case';
import { UpdateOrganizacionDto } from './dto/update-organizacion.dto';

@Controller('organizations')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, RolesGuard)
@Roles('PROPIETARIO', 'ADMINISTRADOR')
export class OrganizationsController {
  constructor(
    private readonly getOrganizacionActual: GetOrganizacionActualUseCase,
    private readonly actualizarOrganizacionActual: ActualizarOrganizacionActualUseCase,
  ) {}

  @Get('current')
  getCurrent(@CurrentUser() context: RequestContext) {
    return this.getOrganizacionActual.execute(context.organizacionId!);
  }

  @Patch('current')
  updateCurrent(@CurrentUser() context: RequestContext, @Body() dto: UpdateOrganizacionDto) {
    return this.actualizarOrganizacionActual.execute(context.organizacionId!, context.usuarioId, dto);
  }
}
