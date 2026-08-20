import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../../shared/presentation/guards/org-membership.guard';
import { RolesGuard } from '../../../shared/presentation/guards/roles.guard';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import { ModuleGuard } from '../../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../../shared/presentation/decorators/require-module.decorator';
import { PaginacionQueryDto } from '../../../shared/presentation/dto/paginacion.query.dto';
import { ListarPaginasVinculadasUseCase } from '../application/use-cases/listar-paginas-vinculadas.use-case';
import { ListarPaginasDisponiblesUseCase } from '../application/use-cases/listar-paginas-disponibles.use-case';
import { ObtenerPerfilPaginaUseCase } from '../application/use-cases/obtener-perfil-pagina.use-case';
import { VincularPaginaUseCase } from '../application/use-cases/vincular-pagina.use-case';
import { DesvincularPaginaUseCase } from '../application/use-cases/desvincular-pagina.use-case';
import { ResuscribirWebhookPaginaUseCase } from '../application/use-cases/resuscribir-webhook-pagina.use-case';
import { ListarPaginasFiltroUseCase } from '../application/use-cases/listar-paginas-filtro.use-case';
import { VerificarSaludWebhookPaginaUseCase } from '../application/use-cases/verificar-salud-webhook-pagina.use-case';
import { VincularPaginaDto } from './dto/vincular-pagina.dto';

@Controller('meta/pages')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, RolesGuard, ModuleGuard)
@Roles('PROPIETARIO', 'ADMINISTRADOR')
@RequireModule('META_LEADS')
export class MetaPagesController {
  constructor(
    private readonly listarVinculadas: ListarPaginasVinculadasUseCase,
    private readonly listarDisponibles: ListarPaginasDisponiblesUseCase,
    private readonly obtenerPerfil: ObtenerPerfilPaginaUseCase,
    private readonly vincular: VincularPaginaUseCase,
    private readonly desvincular: DesvincularPaginaUseCase,
    private readonly resuscribirWebhook: ResuscribirWebhookPaginaUseCase,
    private readonly listarFiltro: ListarPaginasFiltroUseCase,
    private readonly verificarSalud: VerificarSaludWebhookPaginaUseCase,
  ) {}

  @Get()
  findAll(
    @CurrentUser() ctx: RequestContext,
    @Query() query: PaginacionQueryDto,
  ) {
    return this.listarVinculadas.execute(
      ctx.organizacionId!,
      query.page,
      query.pageSize,
    );
  }

  @Get('available')
  findAvailable(@CurrentUser() ctx: RequestContext) {
    return this.listarDisponibles.execute(ctx.organizacionId!);
  }

  /** Sin restricción de rol — cualquier miembro con el módulo puede poblar el filtro de /leads. */
  @Get('filtro')
  @Roles()
  findFiltro(@CurrentUser() ctx: RequestContext) {
    return this.listarFiltro.execute(ctx.organizacionId!);
  }

  @Get(':id')
  findOne(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.obtenerPerfil.execute(ctx.organizacionId!, id);
  }

  @Post()
  create(@CurrentUser() ctx: RequestContext, @Body() dto: VincularPaginaDto) {
    return this.vincular.execute(
      ctx.organizacionId!,
      dto.pageId,
      dto.pageNombre,
      ctx.usuarioId,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.desvincular.execute(ctx.organizacionId!, id, ctx.usuarioId);
  }

  @Post(':id/resync-webhook')
  resyncWebhook(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.resuscribirWebhook.execute(
      ctx.organizacionId!,
      id,
      ctx.usuarioId,
    );
  }

  @Post(':id/health-check')
  healthCheck(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.verificarSalud.execute(ctx.organizacionId!, id, ctx.usuarioId);
  }
}
