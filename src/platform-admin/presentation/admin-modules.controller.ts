import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../shared/presentation/guards/platform-admin.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import { ListarModulosUseCase } from '../../modules/application/use-cases/listar-modulos.use-case';
import { CrearModuloUseCase } from '../../modules/application/use-cases/crear-modulo.use-case';
import { ActualizarModuloUseCase } from '../../modules/application/use-cases/actualizar-modulo.use-case';
import { CambiarEstadoModuloUseCase } from '../../modules/application/use-cases/cambiar-estado-modulo.use-case';
import { CreateModuloDto } from './dto/create-modulo.dto';
import { UpdateModuloDto } from './dto/update-modulo.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';

@ApiTags('Platform Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin/modules')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminModulesController {
  constructor(
    private readonly listarModulos: ListarModulosUseCase,
    private readonly crearModulo: CrearModuloUseCase,
    private readonly actualizarModulo: ActualizarModuloUseCase,
    private readonly cambiarEstadoModulo: CambiarEstadoModuloUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar módulos del catálogo',
    description:
      'Solo super-admin. Catálogo global de módulos activables por organización.',
  })
  @ApiResponse({ status: 200, description: 'Lista de módulos.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'El usuario no es admin de plataforma.',
  })
  findAll() {
    return this.listarModulos.execute();
  }

  @Post()
  @ApiOperation({
    summary: 'Crear un módulo en el catálogo',
    description: 'Solo super-admin.',
  })
  @ApiResponse({ status: 201, description: 'Módulo creado.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'El usuario no es admin de plataforma.',
  })
  @ApiResponse({ status: 409, description: 'El código de módulo ya existe.' })
  create(@Body() dto: CreateModuloDto, @CurrentUser() ctx: RequestContext) {
    return this.crearModulo.execute(dto, ctx.usuarioId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un módulo del catálogo',
    description: 'Solo super-admin.',
  })
  @ApiResponse({ status: 200, description: 'Módulo actualizado.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'El usuario no es admin de plataforma.',
  })
  @ApiResponse({ status: 404, description: 'El módulo no existe.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateModuloDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.actualizarModulo.execute(id, dto, ctx.usuarioId);
  }

  @Patch(':id/estado')
  @ApiOperation({
    summary: 'Activar/desactivar un módulo en el catálogo global',
    description: 'Solo super-admin.',
  })
  @ApiResponse({ status: 200, description: 'Estado actualizado.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'El usuario no es admin de plataforma.',
  })
  @ApiResponse({ status: 404, description: 'El módulo no existe.' })
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.cambiarEstadoModulo.execute(id, dto.estado, ctx.usuarioId);
  }
}
