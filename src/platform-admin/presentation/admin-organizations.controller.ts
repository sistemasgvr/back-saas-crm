import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { ListarOrganizacionesQueryDto } from './dto/listar-organizaciones.query.dto';
import { PlatformAdminGuard } from '../../shared/presentation/guards/platform-admin.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import { CrearOrganizacionUseCase } from '../application/use-cases/crear-organizacion.use-case';
import { ListarOrganizacionesUseCase } from '../application/use-cases/listar-organizaciones.use-case';
import { ObtenerOrganizacionUseCase } from '../application/use-cases/obtener-organizacion.use-case';
import { ActualizarOrganizacionAdminUseCase } from '../application/use-cases/actualizar-organizacion-admin.use-case';
import { DesactivarOrganizacionUseCase } from '../application/use-cases/desactivar-organizacion.use-case';
import { CreateOrganizacionDto } from './dto/create-organizacion.dto';
import { UpdateOrganizacionAdminDto } from './dto/update-organizacion-admin.dto';

@ApiTags('Platform Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin/organizations')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminOrganizationsController {
  constructor(
    private readonly crearOrganizacion: CrearOrganizacionUseCase,
    private readonly listarOrganizaciones: ListarOrganizacionesUseCase,
    private readonly obtenerOrganizacion: ObtenerOrganizacionUseCase,
    private readonly actualizarOrganizacion: ActualizarOrganizacionAdminUseCase,
    private readonly desactivarOrganizacion: DesactivarOrganizacionUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Crear una organización (tenant)',
    description:
      'Solo super-admin. Opcionalmente crea de una vez su primer usuario PROPIETARIO.',
  })
  @ApiResponse({ status: 201, description: 'Organización creada.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'El usuario no es admin de plataforma.',
  })
  @ApiResponse({ status: 409, description: 'El slug ya existe.' })
  create(
    @Body() dto: CreateOrganizacionDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.crearOrganizacion.execute(dto, ctx.usuarioId);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar organizaciones',
    description:
      'Solo super-admin. Paginado, con búsqueda y filtro por estado.',
  })
  @ApiResponse({ status: 200, description: 'Página de organizaciones.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'El usuario no es admin de plataforma.',
  })
  findAll(@Query() query: ListarOrganizacionesQueryDto) {
    return this.listarOrganizaciones.execute({
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      estado: query.estado,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una organización por id',
    description: 'Solo super-admin.',
  })
  @ApiResponse({ status: 200, description: 'Detalle de la organización.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'El usuario no es admin de plataforma.',
  })
  @ApiResponse({ status: 404, description: 'La organización no existe.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.obtenerOrganizacion.execute(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar una organización',
    description: 'Solo super-admin.',
  })
  @ApiResponse({ status: 200, description: 'Organización actualizada.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'El usuario no es admin de plataforma.',
  })
  @ApiResponse({ status: 404, description: 'La organización no existe.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizacionAdminDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.actualizarOrganizacion.execute(id, dto, ctx.usuarioId);
  }

  @Patch(':id/desactivar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Desactivar una organización',
    description:
      'Solo super-admin. Bloquea el acceso de todos sus usuarios sin borrar datos.',
  })
  @ApiResponse({ status: 200, description: 'Organización desactivada.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'El usuario no es admin de plataforma.',
  })
  @ApiResponse({ status: 404, description: 'La organización no existe.' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.desactivarOrganizacion.execute(id, ctx.usuarioId);
  }
}
