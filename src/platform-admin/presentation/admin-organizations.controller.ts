import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { PaginacionQueryDto } from '../../shared/presentation/dto/paginacion.query.dto';
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
  create(@Body() dto: CreateOrganizacionDto, @CurrentUser() ctx: RequestContext) {
    return this.crearOrganizacion.execute(dto, ctx.usuarioId);
  }

  @Get()
  findAll(@Query() query: PaginacionQueryDto) {
    return this.listarOrganizaciones.execute(query.page, query.pageSize);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.obtenerOrganizacion.execute(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizacionAdminDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.actualizarOrganizacion.execute(id, dto, ctx.usuarioId);
  }

  @Patch(':id/desactivar')
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() ctx: RequestContext) {
    return this.desactivarOrganizacion.execute(id, ctx.usuarioId);
  }
}
