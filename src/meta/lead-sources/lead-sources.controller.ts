import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsIn } from 'class-validator';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../shared/presentation/guards/org-membership.guard';
import { PermisosGuard } from '../../shared/presentation/guards/permisos.guard';
import { RequirePermission } from '../../shared/presentation/decorators/require-permission.decorator';
import { ModuleGuard } from '../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../shared/presentation/decorators/require-module.decorator';
import { LeadSourcesService } from './lead-sources.service';
import type { TipoOrigen } from './lead-sources.service';

class ActualizarOrigenDto {
  @IsIn(['paginas', 'campanas', 'formularios'])
  tipo!: TipoOrigen;

  @IsBoolean()
  habilitado!: boolean;
}

@Controller('meta/lead-sources')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, ModuleGuard, PermisosGuard)
@RequireModule('META_LEADS')
@RequirePermission('meta.configurar')
export class LeadSourcesController {
  constructor(private readonly sources: LeadSourcesService) {}

  @Get()
  listar(@CurrentUser() ctx: RequestContext) {
    return this.sources.listar(ctx.organizacionId!);
  }

  @Patch(':id')
  actualizar(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarOrigenDto,
  ) {
    return this.sources.actualizar(
      ctx.organizacionId!,
      dto.tipo,
      id,
      dto.habilitado,
      ctx.usuarioId,
    );
  }
}
