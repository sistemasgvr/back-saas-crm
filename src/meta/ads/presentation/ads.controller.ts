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
import { ListarAnunciosUseCase } from '../application/use-cases/listar-anuncios.use-case';
import { ListarAnunciosQueryDto } from './dto/listar-anuncios.query.dto';

@ApiTags('Meta Ads')
@ApiBearerAuth('JWT-auth')
@Controller('meta/ads')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, ModuleGuard)
@RequireModule('META_LEADS')
export class AdsController {
  constructor(private readonly listarAnuncios: ListarAnunciosUseCase) {}

  @Get()
  @ApiOperation({
    summary: 'Listar anuncios',
    description:
      'Anuncios conocidos por la organización, opcionalmente filtrados por conjunto de anuncios, para poblar filtros.',
  })
  @ApiResponse({ status: 200, description: 'Anuncios.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({ status: 403, description: 'Módulo META_LEADS no activo.' })
  findAll(
    @CurrentUser() ctx: RequestContext,
    @Query() query: ListarAnunciosQueryDto,
  ) {
    return this.listarAnuncios.execute(
      ctx.organizacionId!,
      query.conjuntoAnuncioId,
    );
  }
}
