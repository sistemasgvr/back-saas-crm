import {
  Body,
  Controller,
  Get,
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
import { ListarUsuariosQueryDto } from './dto/listar-usuarios.query.dto';
import { PlatformAdminGuard } from '../../shared/presentation/guards/platform-admin.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import { CrearUsuarioUseCase } from '../application/use-cases/crear-usuario.use-case';
import { ListarUsuariosUseCase } from '../application/use-cases/listar-usuarios.use-case';
import { ObtenerUsuarioUseCase } from '../application/use-cases/obtener-usuario.use-case';
import { CambiarEstadoUsuarioUseCase } from '../application/use-cases/cambiar-estado-usuario.use-case';
import { AsignarUsuarioAOrganizacionUseCase } from '../application/use-cases/asignar-usuario-a-organizacion.use-case';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';
import { AsignarOrganizacionDto } from './dto/asignar-organizacion.dto';

@ApiTags('Platform Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminUsersController {
  constructor(
    private readonly crearUsuario: CrearUsuarioUseCase,
    private readonly listarUsuarios: ListarUsuariosUseCase,
    private readonly obtenerUsuario: ObtenerUsuarioUseCase,
    private readonly cambiarEstadoUsuario: CambiarEstadoUsuarioUseCase,
    private readonly asignarUsuarioAOrganizacion: AsignarUsuarioAOrganizacionUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Crear un usuario',
    description:
      'Solo super-admin. Opcionalmente lo asigna de una vez a una organización con un rol.',
  })
  @ApiResponse({ status: 201, description: 'Usuario creado.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'El usuario no es admin de plataforma.',
  })
  @ApiResponse({ status: 409, description: 'El email ya está registrado.' })
  create(@Body() dto: CreateUsuarioDto, @CurrentUser() ctx: RequestContext) {
    return this.crearUsuario.execute(dto, ctx.usuarioId);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar usuarios',
    description:
      'Solo super-admin. Paginado, con búsqueda y filtros por estado y admin de plataforma.',
  })
  @ApiResponse({ status: 200, description: 'Página de usuarios.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'El usuario no es admin de plataforma.',
  })
  findAll(@Query() query: ListarUsuariosQueryDto) {
    return this.listarUsuarios.execute({
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      estado: query.estado,
      esAdminPlataforma: query.esAdminPlataforma,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un usuario por id',
    description: 'Solo super-admin.',
  })
  @ApiResponse({ status: 200, description: 'Detalle del usuario.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'El usuario no es admin de plataforma.',
  })
  @ApiResponse({ status: 404, description: 'El usuario no existe.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.obtenerUsuario.execute(id);
  }

  @Patch(':id/estado')
  @ApiOperation({
    summary: 'Activar/desactivar un usuario',
    description: 'Solo super-admin.',
  })
  @ApiResponse({ status: 200, description: 'Estado actualizado.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'El usuario no es admin de plataforma.',
  })
  @ApiResponse({ status: 404, description: 'El usuario no existe.' })
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.cambiarEstadoUsuario.execute(id, dto.estado, ctx.usuarioId);
  }

  @Post(':id/organizaciones')
  @ApiOperation({
    summary: 'Asignar un usuario a una organización',
    description: 'Solo super-admin. Crea la membresía con el rol indicado.',
  })
  @ApiResponse({
    status: 201,
    description: 'Usuario asignado a la organización.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'El usuario no es admin de plataforma.',
  })
  @ApiResponse({
    status: 404,
    description: 'El usuario o la organización no existen.',
  })
  @ApiResponse({
    status: 409,
    description: 'El usuario ya pertenece a esa organización.',
  })
  assignToOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarOrganizacionDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.asignarUsuarioAOrganizacion.execute(
      id,
      dto.organizacionId,
      dto.rol,
      ctx.usuarioId,
    );
  }
}
