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
import { ObtenerPipelineConfigUseCase } from '../application/use-cases/obtener-pipeline-config.use-case';
import { ActualizarPipelineConfigUseCase } from '../application/use-cases/actualizar-pipeline-config.use-case';
import { UpdateOrganizacionDto } from './dto/update-organizacion.dto';
import { ActualizarPipelineConfigDto } from './dto/actualizar-pipeline-config.dto';

@ApiTags('Organizations')
@ApiBearerAuth('JWT-auth')
@Controller('organizations')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, RolesGuard)
@Roles('PROPIETARIO', 'ADMINISTRADOR')
export class OrganizationsController {
  constructor(
    private readonly getOrganizacionActual: GetOrganizacionActualUseCase,
    private readonly actualizarOrganizacionActual: ActualizarOrganizacionActualUseCase,
    private readonly obtenerPipelineConfig: ObtenerPipelineConfigUseCase,
    private readonly actualizarPipelineConfig: ActualizarPipelineConfigUseCase,
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

  @Get('current/pipeline-config')
  @ApiOperation({
    summary: 'Override de matrices del pipeline (o null = defaults de código)',
  })
  @ApiResponse({ status: 200, description: 'Config actual + defaults.' })
  getPipelineConfig(@CurrentUser() context: RequestContext) {
    return this.obtenerPipelineConfig.execute(context.organizacionId!);
  }

  @Patch('current/pipeline-config')
  @ApiOperation({
    summary: 'Guardar o restaurar el override de pipeline de la organización',
    description:
      'Body `{ config: { COMPRA, VENTA, OTRO } }` valida estados/transiciones. ' +
      '`{ config: null }` borra el override y vuelve a las matrices de código.',
  })
  @ApiResponse({ status: 200, description: 'Config guardada.' })
  @ApiResponse({ status: 400, description: 'JSON inválido.' })
  updatePipelineConfig(
    @CurrentUser() context: RequestContext,
    @Body() dto: ActualizarPipelineConfigDto,
  ) {
    return this.actualizarPipelineConfig.execute(
      context.organizacionId!,
      context.usuarioId,
      dto.config,
    );
  }
}
