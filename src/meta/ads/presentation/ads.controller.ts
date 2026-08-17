import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../../shared/presentation/guards/org-membership.guard';
import { ModuleGuard } from '../../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../../shared/presentation/decorators/require-module.decorator';
import { ListarAnunciosUseCase } from '../application/use-cases/listar-anuncios.use-case';
import { ListarAnunciosQueryDto } from './dto/listar-anuncios.query.dto';

@Controller('meta/ads')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, ModuleGuard)
@RequireModule('META_LEADS')
export class AdsController {
  constructor(private readonly listarAnuncios: ListarAnunciosUseCase) {}

  @Get()
  findAll(@CurrentUser() ctx: RequestContext, @Query() query: ListarAnunciosQueryDto) {
    return this.listarAnuncios.execute(ctx.organizacionId!, query.conjuntoAnuncioId);
  }
}
