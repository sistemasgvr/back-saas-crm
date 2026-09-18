import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
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
import { ModuleGuard } from '../../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../../shared/presentation/decorators/require-module.decorator';
import { ObtenerIceServersUseCase } from '../application/use-cases/obtener-ice-servers.use-case';
import { ObtenerCapacidadCallingOrgUseCase } from '../application/use-cases/obtener-capacidad-calling-org.use-case';
import { GetPresenciaLlamadasUseCase } from '../application/use-cases/get-presencia-llamadas.use-case';
import { SetPresenciaLlamadasUseCase } from '../application/use-cases/set-presencia-llamadas.use-case';
import { ListarLlamadasUseCase } from '../application/use-cases/listar-llamadas.use-case';
import { ObtenerLlamadaUseCase } from '../application/use-cases/obtener-llamada.use-case';
import { ActualizarLlamadaUseCase } from '../application/use-cases/actualizar-llamada.use-case';
import { PreAcceptLlamadaUseCase } from '../application/use-cases/pre-accept-llamada.use-case';
import { AcceptLlamadaUseCase } from '../application/use-cases/accept-llamada.use-case';
import { RejectLlamadaUseCase } from '../application/use-cases/reject-llamada.use-case';
import { TerminateLlamadaUseCase } from '../application/use-cases/terminate-llamada.use-case';
import { IniciarLlamadaSalienteUseCase } from '../application/use-cases/iniciar-llamada-saliente.use-case';
import { ObtenerPermisoLlamadaUseCase } from '../application/use-cases/obtener-permiso-llamada.use-case';
import { SolicitarPermisoLlamadaUseCase } from '../application/use-cases/solicitar-permiso-llamada.use-case';
import { ObtenerSettingsLlamadaUseCase } from '../application/use-cases/obtener-settings-llamada.use-case';
import { ActualizarSettingsLlamadaUseCase } from '../application/use-cases/actualizar-settings-llamada.use-case';
import { MetricasLlamadasUseCase } from '../application/use-cases/metricas-llamadas.use-case';
import {
  ActualizarLlamadaDto,
  ActualizarSettingsLlamadaDto,
  IniciarLlamadaSalienteDto,
  PresenciaLlamadasDto,
  SdpDto,
  SolicitarPermisoDto,
} from './dto/calls.dto';

@ApiTags('WhatsApp Calls')
@ApiBearerAuth('JWT-auth')
@Controller('whatsapp/calls')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, RolesGuard, ModuleGuard)
@RequireModule('WHATSAPP')
export class WhatsappCallsController {
  constructor(
    private readonly iceServers: ObtenerIceServersUseCase,
    private readonly capacidad: ObtenerCapacidadCallingOrgUseCase,
    private readonly getPresencia: GetPresenciaLlamadasUseCase,
    private readonly setPresencia: SetPresenciaLlamadasUseCase,
    private readonly listar: ListarLlamadasUseCase,
    private readonly obtener: ObtenerLlamadaUseCase,
    private readonly actualizar: ActualizarLlamadaUseCase,
    private readonly preAccept: PreAcceptLlamadaUseCase,
    private readonly accept: AcceptLlamadaUseCase,
    private readonly reject: RejectLlamadaUseCase,
    private readonly terminate: TerminateLlamadaUseCase,
    private readonly saliente: IniciarLlamadaSalienteUseCase,
    private readonly obtenerPermiso: ObtenerPermisoLlamadaUseCase,
    private readonly solicitarPermiso: SolicitarPermisoLlamadaUseCase,
    private readonly obtenerSettings: ObtenerSettingsLlamadaUseCase,
    private readonly actualizarSettings: ActualizarSettingsLlamadaUseCase,
    private readonly metricas: MetricasLlamadasUseCase,
  ) {}

  @Get('ice-servers')
  @ApiOperation({ summary: 'STUN/TURN para WebRTC del browser' })
  @ApiResponse({ status: 200, description: 'ICE servers.' })
  getIceServers() {
    return this.iceServers.execute();
  }

  @Get('capacidad')
  @ApiOperation({ summary: 'Capacidad Calling de la organización' })
  getCapacidad(@CurrentUser() ctx: RequestContext) {
    return this.capacidad.execute(ctx.organizacionId!);
  }

  @Get('presencia')
  @ApiOperation({ summary: 'Presencia propia y agentes disponibles' })
  getPresenciaLlamadas(@CurrentUser() ctx: RequestContext) {
    return this.getPresencia.execute(ctx.organizacionId!, ctx.usuarioId);
  }

  @Put('presencia')
  @ApiOperation({ summary: 'Marcar disponibilidad para llamadas' })
  putPresencia(
    @CurrentUser() ctx: RequestContext,
    @Body() dto: PresenciaLlamadasDto,
  ) {
    return this.setPresencia.execute(
      ctx.organizacionId!,
      ctx.usuarioId,
      dto.disponible,
    );
  }

  @Get('metricas')
  @ApiOperation({ summary: 'Agregados simples de llamadas' })
  getMetricas(
    @CurrentUser() ctx: RequestContext,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.metricas.execute(
      ctx.organizacionId!,
      desde ? new Date(desde) : undefined,
      hasta ? new Date(hasta) : undefined,
    );
  }

  @Get('permiso')
  @ApiOperation({ summary: 'Consultar permiso de llamada en Meta' })
  getPermiso(
    @CurrentUser() ctx: RequestContext,
    @Query('conversacionId') conversacionId?: string,
    @Query('waId') waId?: string,
  ) {
    return this.obtenerPermiso.execute(ctx.organizacionId!, {
      conversacionId,
      waId,
    });
  }

  @Post('permiso')
  @ApiOperation({ summary: 'Solicitar permiso de llamada al contacto' })
  postPermiso(
    @CurrentUser() ctx: RequestContext,
    @Body() dto: SolicitarPermisoDto,
  ) {
    return this.solicitarPermiso.execute(ctx.organizacionId!, dto);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Settings de Calling en Meta' })
  getSettings(
    @CurrentUser() ctx: RequestContext,
    @Query('conexionId') conexionId?: string,
  ) {
    return this.obtenerSettings.execute(ctx.organizacionId!, conexionId);
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Actualizar settings de Calling en Meta' })
  patchSettings(
    @CurrentUser() ctx: RequestContext,
    @Body() dto: ActualizarSettingsLlamadaDto,
  ) {
    return this.actualizarSettings.execute(ctx.organizacionId!, dto);
  }

  @Post('saliente')
  @ApiOperation({ summary: 'Iniciar llamada saliente (BIC)' })
  postSaliente(
    @CurrentUser() ctx: RequestContext,
    @Body() dto: IniciarLlamadaSalienteDto,
  ) {
    return this.saliente.execute(ctx.organizacionId!, dto, ctx.usuarioId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar historial de llamadas' })
  findAll(
    @CurrentUser() ctx: RequestContext,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('asesorId') asesorId?: string,
    @Query('resultado') resultado?: string,
    @Query('leadId') leadId?: string,
    @Query('conversacionId') conversacionId?: string,
    @Query('page') page?: string,
  ) {
    return this.listar.execute(ctx.organizacionId!, {
      desde: desde ? new Date(desde) : undefined,
      hasta: hasta ? new Date(hasta) : undefined,
      asesorId,
      resultado,
      leadId,
      conversacionId,
      page: page ? Number(page) : 1,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una llamada' })
  findOne(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.obtener.execute(ctx.organizacionId!, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar nota/motivo post-llamada' })
  patchOne(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarLlamadaDto,
  ) {
    return this.actualizar.execute(ctx.organizacionId!, id, dto);
  }

  @Post(':callId/pre-accept')
  @ApiOperation({ summary: 'pre_accept con SDP answer (claim lock)' })
  postPreAccept(
    @CurrentUser() ctx: RequestContext,
    @Param('callId') callId: string,
    @Body() dto: SdpDto,
  ) {
    return this.preAccept.execute(
      ctx.organizacionId!,
      callId,
      dto.sdp,
      ctx.usuarioId,
    );
  }

  @Post(':callId/accept')
  @ApiOperation({ summary: 'accept con SDP answer' })
  postAccept(
    @CurrentUser() ctx: RequestContext,
    @Param('callId') callId: string,
    @Body() dto: SdpDto,
  ) {
    return this.accept.execute(
      ctx.organizacionId!,
      callId,
      dto.sdp,
      ctx.usuarioId,
    );
  }

  @Post(':callId/reject')
  @ApiOperation({ summary: 'Rechazar llamada entrante' })
  postReject(
    @CurrentUser() ctx: RequestContext,
    @Param('callId') callId: string,
  ) {
    return this.reject.execute(
      ctx.organizacionId!,
      callId,
      ctx.usuarioId,
    );
  }

  @Post(':callId/terminate')
  @ApiOperation({ summary: 'Colgar / terminate llamada activa' })
  postTerminate(
    @CurrentUser() ctx: RequestContext,
    @Param('callId') callId: string,
  ) {
    return this.terminate.execute(ctx.organizacionId!, callId);
  }
}
