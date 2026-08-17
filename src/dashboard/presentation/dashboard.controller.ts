import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../../shared/presentation/guards/org-membership.guard';
import { ModuleGuard } from '../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../shared/presentation/decorators/require-module.decorator';

// Stub: los KPIs y series reales llegan en la Fase 11. Por ahora existe para
// probar el ModuleGuard (PLAN.md §10, Fase 4 — "done" cuando apagar DASHBOARD
// hace que este endpoint responda 403).
@Controller('dashboard')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, ModuleGuard)
@RequireModule('DASHBOARD')
export class DashboardController {
  @Get('kpis')
  getKpis() {
    return { pendiente: 'Fase 11' };
  }

  @Get('series')
  getSeries() {
    return { pendiente: 'Fase 11' };
  }
}
