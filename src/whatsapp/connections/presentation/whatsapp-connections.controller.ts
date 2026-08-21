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
import { ListarNumerosVinculadosUseCase } from '../application/use-cases/listar-numeros-vinculados.use-case';
import { ListarNumerosDisponiblesUseCase } from '../application/use-cases/listar-numeros-disponibles.use-case';
import { VincularNumeroUseCase } from '../application/use-cases/vincular-numero.use-case';
import { DesvincularNumeroUseCase } from '../application/use-cases/desvincular-numero.use-case';
import { VincularNumeroDto } from './dto/vincular-numero.dto';

@Controller('whatsapp/connections')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, RolesGuard, ModuleGuard)
@Roles('PROPIETARIO', 'ADMINISTRADOR')
@RequireModule('WHATSAPP')
export class WhatsappConnectionsController {
  constructor(
    private readonly listarVinculados: ListarNumerosVinculadosUseCase,
    private readonly listarDisponibles: ListarNumerosDisponiblesUseCase,
    private readonly vincular: VincularNumeroUseCase,
    private readonly desvincular: DesvincularNumeroUseCase,
  ) {}

  @Get()
  findAll(@CurrentUser() ctx: RequestContext) {
    return this.listarVinculados.execute(ctx.organizacionId!);
  }

  @Get('available')
  findAvailable(@CurrentUser() ctx: RequestContext) {
    return this.listarDisponibles.execute(ctx.organizacionId!);
  }

  @Post()
  create(@CurrentUser() ctx: RequestContext, @Body() dto: VincularNumeroDto) {
    return this.vincular.execute(
      ctx.organizacionId!,
      dto.wabaId,
      dto.phoneNumberId,
      dto.numeroDisplay,
      dto.nombreVerificado,
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
}
