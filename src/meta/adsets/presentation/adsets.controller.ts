import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../../shared/presentation/guards/org-membership.guard';
import { ModuleGuard } from '../../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../../shared/presentation/decorators/require-module.decorator';
import { ListarConjuntosAnunciosUseCase } from '../application/use-cases/listar-conjuntos-anuncios.use-case';
import { ListarConjuntosAnunciosQueryDto } from './dto/listar-conjuntos-anuncios.query.dto';

@ApiTags('Meta Ad Sets')
@ApiBearerAuth('JWT-auth')
@Controller('meta/adsets')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, ModuleGuard)
@RequireModule('META_LEADS')
export class AdsetsController {
  constructor(
    private readonly listarConjuntosAnuncios: ListarConjuntosAnunciosUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar conjuntos de anuncios',
    description:
      'Conjuntos de anuncios conocidos por la organización, opcionalmente filtrados por campaña, para poblar filtros.',
  })
  @ApiResponse({ status: 200, description: 'Conjuntos de anuncios.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({ status: 403, description: 'Módulo META_LEADS no activo.' })
  findAll(
    @CurrentUser() ctx: RequestContext,
    @Query() query: ListarConjuntosAnunciosQueryDto,
  ) {
    return this.listarConjuntosAnuncios.execute(
      ctx.organizacionId!,
      query.campanaId,
    );
  }
}
