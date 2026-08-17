import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../shared/presentation/guards/org-membership.guard';
import { ModuleGuard } from '../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../shared/presentation/decorators/require-module.decorator';
import { ListarLeadsUseCase } from '../application/use-cases/listar-leads.use-case';
import { ObtenerLeadUseCase } from '../application/use-cases/obtener-lead.use-case';
import { ListarLeadsQueryDto } from './dto/listar-leads.query.dto';

@Controller('leads')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, ModuleGuard)
@RequireModule('META_LEADS')
export class LeadsController {
  constructor(
    private readonly listarLeads: ListarLeadsUseCase,
    private readonly obtenerLead: ObtenerLeadUseCase,
  ) {}

  @Get()
  findAll(@CurrentUser() ctx: RequestContext, @Query() query: ListarLeadsQueryDto) {
    return this.listarLeads.execute(ctx.organizacionId!, query);
  }

  @Get(':id')
  findOne(@CurrentUser() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.obtenerLead.execute(ctx.organizacionId!, id);
  }
}
