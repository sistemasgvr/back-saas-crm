import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../shared/presentation/guards/platform-admin.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import { ListarMatrizModulosOrganizacionUseCase } from '../application/use-cases/listar-matriz-modulos-organizacion.use-case';
import { ToggleModuloOrganizacionUseCase } from '../application/use-cases/toggle-modulo-organizacion.use-case';
import { ToggleModuloDto } from './dto/toggle-modulo.dto';

@ApiTags('Platform Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin/organizations/:organizacionId/modules')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminOrganizationModulesController {
  constructor(
    private readonly listarMatriz: ListarMatrizModulosOrganizacionUseCase,
    private readonly toggleModulo: ToggleModuloOrganizacionUseCase,
  ) {}

  @Get()
  @ApiParam({ name: 'organizacionId', description: 'Id de la organización' })
  @ApiOperation({
    summary: 'Matriz de módulos de una organización',
    description:
      'Solo super-admin. Lista todo el catálogo de módulos marcando cuáles están habilitados para esta organización.',
  })
  @ApiResponse({ status: 200, description: 'Matriz de módulos.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'El usuario no es admin de plataforma.',
  })
  @ApiResponse({ status: 404, description: 'La organización no existe.' })
  findAll(@Param('organizacionId', ParseUUIDPipe) organizacionId: string) {
    return this.listarMatriz.execute(organizacionId);
  }

  @Patch(':moduloId')
  @ApiParam({ name: 'organizacionId', description: 'Id de la organización' })
  @ApiParam({ name: 'moduloId', description: 'Id del módulo del catálogo' })
  @ApiOperation({
    summary: 'Habilitar/deshabilitar un módulo para una organización',
    description: 'Solo super-admin.',
  })
  @ApiResponse({
    status: 200,
    description: 'Módulo actualizado para la organización.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'El usuario no es admin de plataforma.',
  })
  @ApiResponse({
    status: 404,
    description: 'La organización o el módulo no existen.',
  })
  toggle(
    @Param('organizacionId', ParseUUIDPipe) organizacionId: string,
    @Param('moduloId', ParseUUIDPipe) moduloId: string,
    @Body() dto: ToggleModuloDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.toggleModulo.execute(
      organizacionId,
      moduloId,
      dto.habilitado,
      ctx.usuarioId,
    );
  }
}
