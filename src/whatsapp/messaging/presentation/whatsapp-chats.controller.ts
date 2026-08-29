import {
  Body,
  Controller,
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
import { ListarConversacionesUseCase } from '../application/use-cases/listar-conversaciones.use-case';
import { ObtenerConversacionUseCase } from '../application/use-cases/obtener-conversacion.use-case';
import { EnviarMensajeWhatsAppUseCase } from '../application/use-cases/enviar-mensaje-whatsapp.use-case';
import { ListarPlantillasUseCase } from '../application/use-cases/listar-plantillas.use-case';
import { CrearPlantillaUseCase } from '../application/use-cases/crear-plantilla.use-case';
import { IniciarConversacionDesdeLeadUseCase } from '../application/use-cases/iniciar-conversacion-desde-lead.use-case';
import { EnviarMensajeDto } from './dto/enviar-mensaje.dto';
import { CrearPlantillaDto } from './dto/crear-plantilla.dto';

@ApiTags('WhatsApp Chats')
@ApiBearerAuth('JWT-auth')
@Controller('whatsapp/chats')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, RolesGuard, ModuleGuard)
@RequireModule('WHATSAPP')
export class WhatsappChatsController {
  constructor(
    private readonly listarConversaciones: ListarConversacionesUseCase,
    private readonly obtenerConversacion: ObtenerConversacionUseCase,
    private readonly enviarMensaje: EnviarMensajeWhatsAppUseCase,
    private readonly listarPlantillas: ListarPlantillasUseCase,
    private readonly crearPlantilla: CrearPlantillaUseCase,
    private readonly iniciarDesdeLead: IniciarConversacionDesdeLeadUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar conversaciones',
    description:
      'Conversaciones de WhatsApp de la organización, acotadas por rol (un VENDEDOR solo ve las de sus leads asignados).',
  })
  @ApiResponse({ status: 200, description: 'Conversaciones.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({ status: 403, description: 'Módulo WHATSAPP no activo.' })
  findAll(@CurrentUser() ctx: RequestContext) {
    return this.listarConversaciones.execute(ctx.organizacionId!, {
      usuarioId: ctx.usuarioId,
      rol: ctx.rol!,
    });
  }

  @Get('templates')
  @ApiOperation({
    summary: 'Plantillas aprobadas',
    description:
      'Solo plantillas con estado APPROVED en Meta, listas para enviar fuera de la ventana de 24h.',
  })
  @ApiResponse({ status: 200, description: 'Plantillas aprobadas.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({ status: 403, description: 'Módulo WHATSAPP no activo.' })
  templates(@CurrentUser() ctx: RequestContext) {
    return this.listarPlantillas.execute(ctx.organizacionId!);
  }

  /** Todas (con estado), no solo APPROVED — para la pantalla de gestión. */
  @Get('templates/all')
  @Roles('PROPIETARIO', 'ADMINISTRADOR')
  @ApiOperation({
    summary: 'Todas las plantillas (con estado)',
    description:
      'Incluye PENDING y REJECTED — para la pantalla de gestión de plantillas.',
  })
  @ApiResponse({ status: 200, description: 'Todas las plantillas.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo WHATSAPP no activo.',
  })
  templatesAll(@CurrentUser() ctx: RequestContext) {
    return this.listarPlantillas.execute(ctx.organizacionId!, false);
  }

  @Post('templates')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('PROPIETARIO', 'ADMINISTRADOR')
  @ApiOperation({
    summary: 'Crear una plantilla de mensaje',
    description:
      'Envía la plantilla a Meta para revisión (queda PENDING hasta que Meta la aprueba/rechaza). Si el ' +
      'cuerpo o el encabezado usan variables {{1}}, {{2}}…, hace falta un ejemplo por cada una.',
  })
  @ApiResponse({ status: 204, description: 'Plantilla enviada a revisión.' })
  @ApiResponse({
    status: 400,
    description:
      'Faltan ejemplos para las variables usadas, o el encabezado usa más de una variable.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente o módulo WHATSAPP no activo.',
  })
  createTemplate(
    @CurrentUser() ctx: RequestContext,
    @Body() dto: CrearPlantillaDto,
  ) {
    return this.crearPlantilla.execute(ctx.organizacionId!, dto);
  }

  @Post('start-from-lead/:leadId')
  @ApiOperation({
    summary: 'Iniciar/abrir un chat desde un lead',
    description:
      'Busca o crea la conversación de WhatsApp asociada al teléfono del lead (heurística de coincidencia por últimos dígitos, con fallback de prefijo "51" para números peruanos de 9 dígitos).',
  })
  @ApiResponse({
    status: 201,
    description: 'Id de la conversación (existente o recién creada).',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({ status: 403, description: 'Módulo WHATSAPP no activo.' })
  @ApiResponse({
    status: 404,
    description: 'El lead no existe o no tiene teléfono.',
  })
  startFromLead(
    @CurrentUser() ctx: RequestContext,
    @Param('leadId', ParseUUIDPipe) leadId: string,
  ) {
    return this.iniciarDesdeLead.execute(ctx.organizacionId!, leadId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una conversación con sus mensajes' })
  @ApiResponse({
    status: 200,
    description: 'Conversación con historial de mensajes.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({ status: 403, description: 'Módulo WHATSAPP no activo.' })
  @ApiResponse({
    status: 404,
    description: 'La conversación no existe o el rol no puede verla.',
  })
  findOne(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.obtenerConversacion.execute(ctx.organizacionId!, id, {
      usuarioId: ctx.usuarioId,
      rol: ctx.rol!,
    });
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Enviar un mensaje',
    description:
      'Dentro de la ventana de 24h desde el último mensaje del cliente, envía texto libre (`texto`). Fuera de ' +
      'la ventana, requiere una plantilla aprobada (`plantillaNombre` + `plantillaIdioma`, y `parametros` si ' +
      'la plantilla usa variables).',
  })
  @ApiResponse({ status: 204, description: 'Mensaje enviado.' })
  @ApiResponse({
    status: 400,
    description:
      'Fuera de la ventana de 24h sin plantilla, o parámetros de plantilla incompletos.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({ status: 403, description: 'Módulo WHATSAPP no activo.' })
  @ApiResponse({
    status: 404,
    description:
      'La conversación no existe o el rol no puede escribir en ella.',
  })
  send(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnviarMensajeDto,
  ) {
    return this.enviarMensaje.execute(ctx.organizacionId!, id, dto, {
      usuarioId: ctx.usuarioId,
      rol: ctx.rol!,
    });
  }
}
