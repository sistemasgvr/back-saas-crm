import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { PaginacionQueryDto } from '../../shared/presentation/dto/paginacion.query.dto';
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
  create(@Body() dto: CreateUsuarioDto, @CurrentUser() ctx: RequestContext) {
    return this.crearUsuario.execute(dto, ctx.usuarioId);
  }

  @Get()
  findAll(@Query() query: PaginacionQueryDto) {
    return this.listarUsuarios.execute(query.page, query.pageSize);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.obtenerUsuario.execute(id);
  }

  @Patch(':id/estado')
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.cambiarEstadoUsuario.execute(id, dto.estado, ctx.usuarioId);
  }

  @Post(':id/organizaciones')
  assignToOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarOrganizacionDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.asignarUsuarioAOrganizacion.execute(id, dto.organizacionId, dto.rol, ctx.usuarioId);
  }
}
