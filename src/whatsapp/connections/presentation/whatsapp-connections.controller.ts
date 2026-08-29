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
import { RolesGuard } from '../../../shared/presentation/guards/roles.guard';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import { ModuleGuard } from '../../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../../shared/presentation/decorators/require-module.decorator';
import { ListarNumerosVinculadosUseCase } from '../application/use-cases/listar-numeros-vinculados.use-case';
import { ListarNumerosDisponiblesUseCase } from '../application/use-cases/listar-numeros-disponibles.use-case';
import { VincularNumeroUseCase } from '../application/use-cases/vincular-numero.use-case';
import { DesvincularNumeroUseCase } from '../application/use-cases/desvincular-numero.use-case';
import { VincularNumeroDto } from './dto/vincular-numero.dto';

@ApiTags('WhatsApp Connections')
@ApiBearerAuth('JWT-auth')
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
  @ApiOperation({ summary: 'Listar números de WhatsApp vinculados' })
  @ApiResponse({ status: 200, description: 'Números vinculados.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo WHATSAPP no activo.',
  })
  findAll(@CurrentUser() ctx: RequestContext) {
    return this.listarVinculados.execute(ctx.organizacionId!);
  }

  @Get('available')
  @ApiOperation({
    summary: 'Números disponibles para vincular',
    description:
      'Consulta en vivo a Graph API los números de WhatsApp accesibles con la conexión de Meta actual.',
  })
  @ApiResponse({ status: 200, description: 'Números disponibles.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo WHATSAPP no activo.',
  })
  findAvailable(@CurrentUser() ctx: RequestContext) {
    return this.listarDisponibles.execute(ctx.organizacionId!);
  }

  @Post()
  @ApiOperation({ summary: 'Vincular un número de WhatsApp' })
  @ApiResponse({ status: 201, description: 'Número vinculado.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo WHATSAPP no activo.',
  })
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
  @ApiOperation({ summary: 'Desvincular un número de WhatsApp' })
  @ApiResponse({ status: 204, description: 'Número desvinculado.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo WHATSAPP no activo.',
  })
  @ApiResponse({
    status: 404,
    description: 'El número no existe o no pertenece a la organización.',
  })
  async remove(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.desvincular.execute(ctx.organizacionId!, id, ctx.usuarioId);
  }
}
