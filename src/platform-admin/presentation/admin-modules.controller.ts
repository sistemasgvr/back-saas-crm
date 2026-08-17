import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
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
  findAll() {
    return this.listarModulos.execute();
  }

  @Post()
  create(@Body() dto: CreateModuloDto, @CurrentUser() ctx: RequestContext) {
    return this.crearModulo.execute(dto, ctx.usuarioId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateModuloDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.actualizarModulo.execute(id, dto, ctx.usuarioId);
  }

  @Patch(':id/estado')
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.cambiarEstadoModulo.execute(id, dto.estado, ctx.usuarioId);
  }
}
