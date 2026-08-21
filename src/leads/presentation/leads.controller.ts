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
  asignables(@CurrentUser() ctx: RequestContext) {
    return this.leadsLectura.listarMiembrosAsignables(ctx.organizacionId!);
  }

  @Get(':id')
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
  @HttpCode(HttpStatus.OK)
  claim(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tomarLead.execute(ctx.organizacionId!, id, ctx.usuarioId);
  }

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  @Roles('PROPIETARIO', 'ADMINISTRADOR')
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
  @HttpCode(HttpStatus.OK)
  @Roles('PROPIETARIO', 'ADMINISTRADOR')
  release(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.liberarLead.execute(ctx.organizacionId!, id);
  }

  @Patch(':id/gestion')
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
