import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../shared/presentation/guards/org-membership.guard';
import { RolesGuard } from '../../shared/presentation/guards/roles.guard';
import { Roles } from '../../shared/presentation/decorators/roles.decorator';
import { GetOrganizacionActualUseCase } from '../application/use-cases/get-organizacion-actual.use-case';
import { ActualizarOrganizacionActualUseCase } from '../application/use-cases/actualizar-organizacion-actual.use-case';
import { UpdateOrganizacionDto } from './dto/update-organizacion.dto';

@ApiTags('Organizations')
@ApiBearerAuth('JWT-auth')
@Controller('organizations')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, RolesGuard)
@Roles('PROPIETARIO', 'ADMINISTRADOR')
export class OrganizationsController {
  constructor(
    private readonly getOrganizacionActual: GetOrganizacionActualUseCase,
    private readonly actualizarOrganizacionActual: ActualizarOrganizacionActualUseCase,
  ) {}

  @Get('current')
  @ApiOperation({
    summary: 'Obtener la organización activa del usuario autenticado.',
  })
  @ApiResponse({ status: 200, description: 'Datos de la organización.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente (requiere PROPIETARIO o ADMINISTRADOR).',
  })
  getCurrent(@CurrentUser() context: RequestContext) {
    return this.getOrganizacionActual.execute(context.organizacionId!);
  }

  @Patch('current')
  @ApiOperation({ summary: 'Actualizar los datos de la organización activa.' })
  @ApiResponse({ status: 200, description: 'Organización actualizada.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente (requiere PROPIETARIO o ADMINISTRADOR).',
  })
  updateCurrent(
    @CurrentUser() context: RequestContext,
    @Body() dto: UpdateOrganizacionDto,
  ) {
    return this.actualizarOrganizacionActual.execute(
      context.organizacionId!,
      context.usuarioId,
      dto,
    );
  }
}
