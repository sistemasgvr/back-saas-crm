import {
  Body,
  Controller,
  Delete,
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
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../shared/presentation/guards/org-membership.guard';
import { RolesGuard } from '../../shared/presentation/guards/roles.guard';
import { Roles } from '../../shared/presentation/decorators/roles.decorator';
import { ModuleGuard } from '../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../shared/presentation/decorators/require-module.decorator';
import { ListarInmueblesUseCase } from '../application/use-cases/listar-inmuebles.use-case';
import { ListarInmueblesFiltroUseCase } from '../application/use-cases/listar-inmuebles-filtro.use-case';
import { ObtenerInmuebleUseCase } from '../application/use-cases/obtener-inmueble.use-case';
import { CrearInmuebleUseCase } from '../application/use-cases/crear-inmueble.use-case';
import { ActualizarInmuebleUseCase } from '../application/use-cases/actualizar-inmueble.use-case';
import { EliminarInmuebleUseCase } from '../application/use-cases/eliminar-inmueble.use-case';
import { ListarInmueblesQueryDto } from './dto/listar-inmuebles.query.dto';
import { CrearInmuebleDto } from './dto/crear-inmueble.dto';
import { ActualizarInmuebleDto } from './dto/actualizar-inmueble.dto';

@ApiTags('Inmuebles')
@ApiBearerAuth('JWT-auth')
@Controller('inmuebles')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, RolesGuard, ModuleGuard)
@RequireModule('META_LEADS')
export class InmueblesController {
  constructor(
    private readonly listarInmuebles: ListarInmueblesUseCase,
    private readonly listarFiltro: ListarInmueblesFiltroUseCase,
    private readonly obtenerInmueble: ObtenerInmuebleUseCase,
    private readonly crearInmueble: CrearInmuebleUseCase,
    private readonly actualizarInmueble: ActualizarInmuebleUseCase,
    private readonly eliminarInmueble: EliminarInmuebleUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar inmuebles (paginado + filtros)' })
  @ApiResponse({ status: 200, description: 'Página de inmuebles.' })
  findAll(
    @CurrentUser() ctx: RequestContext,
    @Query() query: ListarInmueblesQueryDto,
  ) {
    return this.listarInmuebles.execute(ctx.organizacionId!, {
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      tipo: query.tipo,
      operacion: query.operacion,
      estadoInmueble: query.estadoInmueble,
      zona: query.zona,
    });
  }

  @Get('filtro')
  @ApiOperation({
    summary: 'Inmuebles para selectores (visitas / pipeline)',
    description:
      'Lista liviana de inmuebles DISPONIBLE/RESERVADO para poblar selects.',
  })
  findFiltro(@CurrentUser() ctx: RequestContext) {
    return this.listarFiltro.execute(ctx.organizacionId!);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un inmueble' })
  @ApiResponse({ status: 200, description: 'Inmueble.' })
  @ApiResponse({ status: 404, description: 'No encontrado.' })
  findOne(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.obtenerInmueble.execute(ctx.organizacionId!, id);
  }

  @Post()
  @Roles('PROPIETARIO', 'ADMINISTRADOR')
  @ApiOperation({ summary: 'Crear inmueble' })
  @ApiResponse({ status: 201, description: 'Inmueble creado.' })
  @ApiResponse({ status: 409, description: 'Código duplicado.' })
  create(
    @CurrentUser() ctx: RequestContext,
    @Body() body: CrearInmuebleDto,
  ) {
    return this.crearInmueble.execute(ctx.organizacionId!, body, ctx.usuarioId);
  }

  @Patch(':id')
  @Roles('PROPIETARIO', 'ADMINISTRADOR')
  @ApiOperation({ summary: 'Actualizar inmueble' })
  @ApiResponse({ status: 200, description: 'Inmueble actualizado.' })
  @ApiResponse({ status: 404, description: 'No encontrado.' })
  update(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ActualizarInmuebleDto,
  ) {
    return this.actualizarInmueble.execute(
      ctx.organizacionId!,
      id,
      body,
      ctx.usuarioId,
    );
  }

  @Delete(':id')
  @Roles('PROPIETARIO', 'ADMINISTRADOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar inmueble (soft delete)' })
  @ApiResponse({ status: 204, description: 'Eliminado.' })
  @ApiResponse({ status: 404, description: 'No encontrado.' })
  async remove(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.eliminarInmueble.execute(
      ctx.organizacionId!,
      id,
      ctx.usuarioId,
    );
  }
}
