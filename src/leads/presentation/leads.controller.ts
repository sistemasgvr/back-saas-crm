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
import { ActualizarTipoLeadUseCase } from '../application/use-cases/actualizar-tipo-lead.use-case';
import { LEADS_LECTURA_REPOSITORY } from '../application/ports/leads-lectura.repository.port';
import type { LeadsLecturaRepository } from '../application/ports/leads-lectura.repository.port';
import { ListarLeadsQueryDto } from './dto/listar-leads.query.dto';
import { AsignarLeadDto } from './dto/asignar-lead.dto';
import { ActualizarTipoLeadDto } from './dto/actualizar-tipo-lead.dto';

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
    private readonly actualizarTipoLead: ActualizarTipoLeadUseCase,
    @Inject(LEADS_LECTURA_REPOSITORY)
    private readonly leadsLectura: LeadsLecturaRepository,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar leads',
    description:
      'Lista paginada de leads de la organización con filtros por campaña/anuncio/página/cuenta/formulario, ' +
      'rango de fechas, búsqueda libre y asignación. La visibilidad se acota por rol: un VENDEDOR solo ve ' +
      'sin-asignar + los suyos; PROPIETARIO/ADMINISTRADOR ven todos.',
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

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un lead por id' })
  @ApiResponse({ status: 200, description: 'Detalle del lead.' })
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
    summary: 'Actualizar el tipo de lead (gestión)',
    description: 'Marca la intención comercial del lead (COMPRA/VENTA/OTRO).',
  })
  @ApiResponse({ status: 204, description: 'Tipo de lead actualizado.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 404,
    description: 'El lead no existe o el rol no puede gestionarlo.',
  })
  gestion(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarTipoLeadDto,
  ) {
    return this.actualizarTipoLead.execute(
      ctx.organizacionId!,
      id,
      dto.tipoLead,
      { usuarioId: ctx.usuarioId, rol: ctx.rol! },
    );
  }
}
