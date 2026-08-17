import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../../shared/presentation/guards/org-membership.guard';
import { ModuleGuard } from '../../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../../shared/presentation/decorators/require-module.decorator';
import { ListarConjuntosAnunciosUseCase } from '../application/use-cases/listar-conjuntos-anuncios.use-case';
import { ListarConjuntosAnunciosQueryDto } from './dto/listar-conjuntos-anuncios.query.dto';

@Controller('meta/adsets')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, ModuleGuard)
@RequireModule('META_LEADS')
export class AdsetsController {
  constructor(private readonly listarConjuntosAnuncios: ListarConjuntosAnunciosUseCase) {}

  @Get()
  findAll(@CurrentUser() ctx: RequestContext, @Query() query: ListarConjuntosAnunciosQueryDto) {
    return this.listarConjuntosAnuncios.execute(ctx.organizacionId!, query.campanaId);
  }
}
