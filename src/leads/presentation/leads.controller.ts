import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
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
  ApiQuery,
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
import { ListarLeadsUseCase } from '../application/use-cases/listar-leads.use-case';
import { ObtenerLeadUseCase } from '../application/use-cases/obtener-lead.use-case';
import { TomarLeadUseCase } from '../application/use-cases/tomar-lead.use-case';
import { AsignarLeadUseCase } from '../application/use-cases/asignar-lead.use-case';
import { LiberarLeadUseCase } from '../application/use-cases/liberar-lead.use-case';
import { ActualizarGestionLeadUseCase } from '../application/use-cases/actualizar-gestion-lead.use-case';
import { ObtenerHistorialLeadUseCase } from '../application/use-cases/obtener-historial-lead.use-case';
import { ObtenerMetaPipelineUseCase } from '../application/use-cases/obtener-meta-pipeline.use-case';
import { ListarTableroLeadsUseCase } from '../application/use-cases/listar-tablero-leads.use-case';
import { ContarLeadsNuevosUseCase } from '../application/use-cases/contar-leads-nuevos.use-case';
import { ListarAgendaVisitasUseCase } from '../application/use-cases/listar-agenda-visitas.use-case';
import { ListarVisitasLeadUseCase } from '../application/use-cases/listar-visitas-lead.use-case';
import { ObtenerAutoAsignacionConfigUseCase } from '../application/use-cases/obtener-auto-asignacion-config.use-case';
import { ActualizarAutoAsignacionConfigUseCase } from '../application/use-cases/actualizar-auto-asignacion-config.use-case';
import { LEADS_LECTURA_REPOSITORY } from '../application/ports/leads-lectura.repository.port';
import type { LeadsLecturaRepository } from '../application/ports/leads-lectura.repository.port';
import { ListarLeadsQueryDto } from './dto/listar-leads.query.dto';
import { AsignarLeadDto } from './dto/asignar-lead.dto';
import { ActualizarGestionLeadDto } from './dto/actualizar-gestion-lead.dto';
import { AutoAsignacionLeadsConfigDto } from './dto/auto-asignacion-leads-config.dto';

@ApiTags('Leads')
@ApiBearerAuth('JWT-auth')
@Controller('leads')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, RolesGuard, ModuleGuard)
@RequireModule('META_LEADS')
export class LeadsController {
  constructor(
    private readonly listarLeads: ListarLeadsUseCase,
    private readonly obtenerLead: ObtenerLeadUseCase,
    private readonly tomarLead: TomarLeadUseCase,
    private readonly asignarLead: AsignarLeadUseCase,
    private readonly liberarLead: LiberarLeadUseCase,
    private readonly actualizarGestion: ActualizarGestionLeadUseCase,
    private readonly obtenerHistorial: ObtenerHistorialLeadUseCase,
    private readonly obtenerMetaPipeline: ObtenerMetaPipelineUseCase,
    private readonly listarTablero: ListarTableroLeadsUseCase,
    private readonly contarLeadsNuevos: ContarLeadsNuevosUseCase,
    private readonly listarAgendaVisitas: ListarAgendaVisitasUseCase,
    private readonly listarVisitasLead: ListarVisitasLeadUseCase,
    private readonly obtenerAutoAsignacionConfig: ObtenerAutoAsignacionConfigUseCase,
    private readonly actualizarAutoAsignacionConfig: ActualizarAutoAsignacionConfigUseCase,
    @Inject(LEADS_LECTURA_REPOSITORY)
    private readonly leadsLectura: LeadsLecturaRepository,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar leads',
    description:
      'Lista paginada de leads de la organización con filtros por campaña/anuncio/página/cuenta/formulario, ' +
      'rango de fechas, búsqueda libre, asignación y estado del pipeline. La visibilidad se acota por rol: un ' +
      'VENDEDOR solo ve sin-asignar + los suyos; PROPIETARIO/ADMINISTRADOR ven todos.',
  })
  @ApiResponse({ status: 200, description: 'Página de leads.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'La organización no tiene el módulo META_LEADS activo.',
  })
  findAll(
    @CurrentUser() ctx: RequestContext,
    @Query() query: ListarLeadsQueryDto,
  ) {
    return this.listarLeads.execute(ctx.organizacionId!, query, {
      usuarioId: ctx.usuarioId,
      rol: ctx.rol!,
    });
  }

  /** Antes de :id — si no, Nest lo confunde con un id de lead. */
  @Get('asignables')
  @ApiOperation({
    summary: 'Miembros a los que se puede asignar un lead',
    description:
      'Lista los usuarios activos de la organización, para poblar el selector de asignación.',
  })
  @ApiResponse({ status: 200, description: 'Miembros asignables.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  asignables(@CurrentUser() ctx: RequestContext) {
    return this.leadsLectura.listarMiembrosAsignables(ctx.organizacionId!);
  }

  @Get('auto-asignacion/config')
  @Roles('PROPIETARIO', 'ADMINISTRADOR')
  @ApiOperation({
    summary: 'Configurar auto-asignación secuencial de leads',
    description:
      'Obtiene la configuración por organización para auto-asignar leads NUEVO en round-robin (ej. David/Daimler).',
  })
  @ApiResponse({ status: 200, description: 'Config de auto-asignación.' })
  autoAsignacionConfigGet(@CurrentUser() ctx: RequestContext) {
    return this.obtenerAutoAsignacionConfig.execute(ctx.organizacionId!);
  }

  @Patch('auto-asignacion/config')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('PROPIETARIO', 'ADMINISTRADOR')
  @ApiOperation({
    summary: 'Guardar configuración de auto-asignación secuencial de leads',
  })
  @ApiResponse({ status: 204, description: 'Config actualizada.' })
  autoAsignacionConfigPatch(
    @CurrentUser() ctx: RequestContext,
    @Body() dto: AutoAsignacionLeadsConfigDto,
  ) {
    return this.actualizarAutoAsignacionConfig.execute(ctx.organizacionId!, {
      habilitado: dto.habilitado,
      usuarioIds: dto.usuarioIds,
    });
  }

  @Get('nuevos/count')
  @ApiOperation({
    summary: 'Contador de leads nuevos',
    description:
      'Cantidad de leads en estado NUEVO visibles para el usuario — para badge del sidebar.',
  })
  @ApiResponse({ status: 200, description: '{ count: number }' })
  contarNuevos(@CurrentUser() ctx: RequestContext) {
    return this.contarLeadsNuevos.execute(ctx.organizacionId!, {
      usuarioId: ctx.usuarioId,
      rol: ctx.rol!,
    });
  }

  /** Antes de :id — mismo motivo que /asignables. */
  @Get('pipeline/meta')
  @ApiOperation({
    summary: 'Catálogo del pipeline (estados, transiciones, motivos)',
    description:
      'Estados válidos, sus próximos pasos y los motivos de cierre para un tipoLead dado — el front pinta ' +
      'el copy correcto (Captación vs Visita agendada) sin hardcodear nada (PLAN-PIPELINE-INMOBILIARIA.md §8.3).',
  })
  @ApiQuery({
    name: 'tipoLead',
    required: false,
    enum: ['COMPRA', 'VENTA', 'OTRO'],
    description: 'Si se omite, usa el embudo corto (igual al de OTRO).',
  })
  @ApiResponse({ status: 200, description: 'Catálogo del pipeline.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  metaPipeline(@Query('tipoLead') tipoLead?: string) {
    return this.obtenerMetaPipeline.execute(tipoLead);
  }

  /** Antes de :id — mismo motivo que /asignables. */
  @Get('pipeline/tablero')
  @ApiOperation({
    summary: 'Tablero kanban del pipeline',
    description:
      'Todos los leads del tipo pedido (tope 300, más recientes primero), agrupados por columna de estado. ' +
      'Sin tipoLead devuelve todos los embudos en columnas unificadas. ' +
      'Mover una tarjeta usa el mismo PATCH .../gestion que la vista de detalle — misma validación de transición.',
  })
  @ApiQuery({
    name: 'tipoLead',
    required: false,
    enum: ['COMPRA', 'VENTA', 'OTRO'],
  })
  @ApiQuery({
    name: 'asignado',
    required: false,
    description: '"mios" | "sin_asignar" | UUID de un usuario puntual',
  })
  @ApiResponse({ status: 200, description: 'Columnas con sus leads.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  tablero(
    @CurrentUser() ctx: RequestContext,
    @Query('tipoLead') tipoLead?: string,
    @Query('asignado') asignado?: string,
  ) {
    return this.listarTablero.execute(ctx.organizacionId!, tipoLead, asignado, {
      usuarioId: ctx.usuarioId,
      rol: ctx.rol!,
    });
  }

  @Get('visitas/agenda')
  @ApiOperation({
    summary: 'Agenda de visitas (calendario)',
    description:
      'Lista visitas programadas en un rango de fechas — fuente de verdad para vista calendario y recordatorios.',
  })
  @ApiQuery({ name: 'desde', required: true, description: 'ISO 8601 inicio del rango' })
  @ApiQuery({ name: 'hasta', required: true, description: 'ISO 8601 fin del rango' })
  @ApiQuery({ name: 'asignado', required: false, description: '"mios" o UUID de asesor (admin)' })
  agendaVisitas(
    @CurrentUser() ctx: RequestContext,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Query('asignado') asignado?: string,
  ) {
    return this.listarAgendaVisitas.execute(
      ctx.organizacionId!,
      { desde, hasta, asignado },
      { usuarioId: ctx.usuarioId, rol: ctx.rol! },
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un lead por id' })
  @ApiResponse({
    status: 200,
    description: 'Detalle del lead, incluyendo estado del pipeline.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 404,
    description:
      'El lead no existe, no pertenece a la organización, o el rol no puede verlo.',
  })
  findOne(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.obtenerLead.execute(ctx.organizacionId!, id, {
      usuarioId: ctx.usuarioId,
      rol: ctx.rol!,
    });
  }

  @Get(':id/historial-estados')
  @ApiOperation({
    summary: 'Timeline de cambios de pipeline',
    description:
      'Historial cronológico de cambios de tipoLead/estadoGestion — quién, cuándo, desde/hacia, motivo.',
  })
  @ApiResponse({ status: 200, description: 'Historial de cambios.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 404,
    description: 'El lead no existe o el rol no puede verlo.',
  })
  historialEstados(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.obtenerHistorial.execute(ctx.organizacionId!, id, {
      usuarioId: ctx.usuarioId,
      rol: ctx.rol!,
    });
  }

  @Get(':id/visitas')
  @ApiOperation({
    summary: 'Visitas de un lead',
    description: 'Historial de citas/visitas estructuradas — para detalle y seguimiento.',
  })
  visitasLead(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listarVisitasLead.execute(ctx.organizacionId!, id, {
      usuarioId: ctx.usuarioId,
      rol: ctx.rol!,
    });
  }

  @Post(':id/claim')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Tomar un lead sin asignar',
    description:
      'Autoasigna el lead al usuario autenticado. Falla si el lead ya tiene un responsable.',
  })
  @ApiResponse({ status: 204, description: 'Lead tomado.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({ status: 404, description: 'El lead no existe.' })
  @ApiResponse({
    status: 409,
    description: 'El lead ya está asignado a otro usuario.',
  })
  claim(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tomarLead.execute(ctx.organizacionId!, id, ctx.usuarioId);
  }

  @Post(':id/assign')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('PROPIETARIO', 'ADMINISTRADOR')
  @ApiOperation({
    summary: 'Asignar un lead a un miembro',
    description:
      'Solo PROPIETARIO/ADMINISTRADOR pueden reasignar leads a otro usuario.',
  })
  @ApiResponse({ status: 204, description: 'Lead asignado.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente.' })
  @ApiResponse({
    status: 404,
    description: 'El lead o el usuario destino no existen.',
  })
  assign(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarLeadDto,
  ) {
    return this.asignarLead.execute(
      ctx.organizacionId!,
      id,
      dto.usuarioId,
      ctx.usuarioId,
    );
  }

  @Post(':id/release')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('PROPIETARIO', 'ADMINISTRADOR')
  @ApiOperation({
    summary: 'Liberar un lead',
    description: 'Quita al responsable actual y deja el lead sin asignar.',
  })
  @ApiResponse({ status: 204, description: 'Lead liberado.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente.' })
  @ApiResponse({ status: 404, description: 'El lead no existe.' })
  release(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.liberarLead.execute(ctx.organizacionId!, id);
  }

  @Patch(':id/gestion')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Gestionar el pipeline del lead',
    description:
      'Cambia tipoLead y/o estadoGestion (con motivo/nota de cierre si corresponde). Valida la transición ' +
      'contra la matriz de estados del tipo vigente — ver GET /leads/pipeline/meta. Reabrir un lead cerrado ' +
      'requiere PROPIETARIO/ADMINISTRADOR.',
  })
  @ApiResponse({ status: 204, description: 'Gestión actualizada.' })
  @ApiResponse({
    status: 400,
    description:
      'Transición de estado inválida, o falta un motivo de cierre válido.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description:
      'No eres el dueño del lead ni admin, o intentas reabrir sin ser admin.',
  })
  @ApiResponse({
    status: 404,
    description: 'El lead no existe o el rol no puede gestionarlo.',
  })
  @ApiResponse({
    status: 409,
    description:
      'El estado destino exige tipoLead definido (Compra/Venta) y todavía no lo tiene.',
  })
  gestion(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarGestionLeadDto,
  ) {
    return this.actualizarGestion.execute(ctx.organizacionId!, id, dto, {
      usuarioId: ctx.usuarioId,
      rol: ctx.rol!,
    });
  }
}
