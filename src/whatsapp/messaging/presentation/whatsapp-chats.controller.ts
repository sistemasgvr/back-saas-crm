import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../../shared/presentation/guards/org-membership.guard';
import { RolesGuard } from '../../../shared/presentation/guards/roles.guard';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import { ModuleGuard } from '../../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../../shared/presentation/decorators/require-module.decorator';
import { ListarConversacionesUseCase } from '../application/use-cases/listar-conversaciones.use-case';
import { ContarNoLeidosWhatsAppUseCase } from '../application/use-cases/contar-no-leidos-whatsapp.use-case';
import { ObtenerConversacionUseCase } from '../application/use-cases/obtener-conversacion.use-case';
import { EnviarMensajeWhatsAppUseCase } from '../application/use-cases/enviar-mensaje-whatsapp.use-case';
import { EnviarReaccionWhatsAppUseCase } from '../application/use-cases/enviar-reaccion-whatsapp.use-case';
import { EnviarMediaWhatsAppUseCase } from '../application/use-cases/enviar-media-whatsapp.use-case';
import { EnviarUbicacionWhatsAppUseCase } from '../application/use-cases/enviar-ubicacion-whatsapp.use-case';
import { EnviarContactoWhatsAppUseCase } from '../application/use-cases/enviar-contacto-whatsapp.use-case';
import { EnviarInteractivoWhatsAppUseCase } from '../application/use-cases/enviar-interactivo-whatsapp.use-case';
import { MarcarLeidoWhatsAppUseCase } from '../application/use-cases/marcar-leido-whatsapp.use-case';
import { ObtenerMediaMensajeUseCase } from '../application/use-cases/obtener-media-mensaje.use-case';
import { ListarPlantillasUseCase } from '../application/use-cases/listar-plantillas.use-case';
import { CrearPlantillaUseCase } from '../application/use-cases/crear-plantilla.use-case';
import { IniciarConversacionDesdeLeadUseCase } from '../application/use-cases/iniciar-conversacion-desde-lead.use-case';
import { EnviarMensajeDto } from './dto/enviar-mensaje.dto';
import { EnviarReaccionDto } from './dto/enviar-reaccion.dto';
import { CrearPlantillaDto } from './dto/crear-plantilla.dto';
import { SubirMediaDto } from './dto/subir-media.dto';
import { EnviarUbicacionDto } from './dto/enviar-ubicacion.dto';
import { EnviarContactoDto } from './dto/enviar-contacto.dto';
import { EnviarInteractivoDto } from './dto/enviar-interactivo.dto';
import {
  ReenviarMensajeDto,
  ReenviarMensajesLoteDto,
  MAX_MENSAJES_REENVIAR,
} from './dto/reenviar-mensaje.dto';
import { BloquearContactoWhatsAppUseCase } from '../application/use-cases/bloquear-contacto-whatsapp.use-case';
import { EliminarMensajeWhatsAppCrmUseCase } from '../application/use-cases/eliminar-mensaje-whatsapp-crm.use-case';
import { ReenviarMensajeWhatsAppUseCase } from '../application/use-cases/reenviar-mensaje-whatsapp.use-case';

// El límite real por tipo lo valida validarArchivoWhatsApp() en el use-case
// (5MB imagen / 16MB audio-video / 100MB documento) — este es solo el tope
// del interceptor, generoso para no rechazar antes de dar el mensaje claro.
const LIMITE_MULTER_BYTES = 100 * 1024 * 1024;

@ApiTags('WhatsApp Chats')
@ApiBearerAuth('JWT-auth')
@Controller('whatsapp/chats')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, RolesGuard, ModuleGuard)
@RequireModule('WHATSAPP')
export class WhatsappChatsController {
  constructor(
    private readonly listarConversaciones: ListarConversacionesUseCase,
    private readonly contarNoLeidos: ContarNoLeidosWhatsAppUseCase,
    private readonly obtenerConversacion: ObtenerConversacionUseCase,
    private readonly enviarMensaje: EnviarMensajeWhatsAppUseCase,
    private readonly enviarReaccion: EnviarReaccionWhatsAppUseCase,
    private readonly enviarMedia: EnviarMediaWhatsAppUseCase,
    private readonly enviarUbicacion: EnviarUbicacionWhatsAppUseCase,
    private readonly enviarContacto: EnviarContactoWhatsAppUseCase,
    private readonly enviarInteractivo: EnviarInteractivoWhatsAppUseCase,
    private readonly marcarLeidoWhatsApp: MarcarLeidoWhatsAppUseCase,
    private readonly obtenerMedia: ObtenerMediaMensajeUseCase,
    private readonly listarPlantillas: ListarPlantillasUseCase,
    private readonly crearPlantilla: CrearPlantillaUseCase,
    private readonly iniciarDesdeLead: IniciarConversacionDesdeLeadUseCase,
    private readonly bloquearContacto: BloquearContactoWhatsAppUseCase,
    private readonly eliminarMensajeCrm: EliminarMensajeWhatsAppCrmUseCase,
    private readonly reenviarMensaje: ReenviarMensajeWhatsAppUseCase,
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

  /** Antes de :id — si no, Nest lo confunde con un id de conversación. */
  @Get('unread-count')
  @ApiOperation({
    summary: 'Conteo de chats con mensajes sin leer',
    description:
      'Cantidad de conversaciones visibles para el usuario con al menos un mensaje sin leer (no la suma de ' +
      'mensajes de cada una) — para el badge de "Chats" en el sidebar.',
  })
  @ApiResponse({
    status: 200,
    description: 'Conteo de chats con mensajes sin leer.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({ status: 403, description: 'Módulo WHATSAPP no activo.' })
  unreadCount(@CurrentUser() ctx: RequestContext) {
    return this.contarNoLeidos
      .execute(ctx.organizacionId!, { usuarioId: ctx.usuarioId, rol: ctx.rol! })
      .then((count) => ({ count }));
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
      'cuerpo o el encabezado usan variables {{nombre}}, hace falta un ejemplo con contenido por cada una.',
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
    summary: 'Enviar un mensaje de texto o plantilla',
    description:
      'Dentro de la ventana de 24h desde el último mensaje del cliente, envía texto libre (`texto`). Fuera de ' +
      'la ventana, requiere una plantilla aprobada (`plantillaNombre` + `plantillaIdioma`, y `parametros` si ' +
      'la plantilla usa variables). Para enviar un archivo, usar POST :id/media en su lugar.',
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

  @Post(':id/messages/:mensajeId/reaction')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reaccionar (o sacar la reacción) a un mensaje',
    description:
      'Manda un emoji como reacción sobre un mensaje ya enviado/recibido en esta conversación. Mandar `emoji` ' +
      'vacío ("") saca la reacción que ya estuviera puesta — es el mismo endpoint para poner y sacar.',
  })
  @ApiParam({ name: 'id', description: 'Id de la conversación' })
  @ApiParam({ name: 'mensajeId', description: 'Id del mensaje a reaccionar' })
  @ApiResponse({ status: 204, description: 'Reacción aplicada.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({ status: 403, description: 'Módulo WHATSAPP no activo.' })
  @ApiResponse({
    status: 404,
    description:
      'La conversación o el mensaje no existen, o el rol no puede escribir en ella.',
  })
  reaccionar(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mensajeId', ParseUUIDPipe) mensajeId: string,
    @Body() dto: EnviarReaccionDto,
  ) {
    return this.enviarReaccion.execute(
      ctx.organizacionId!,
      id,
      mensajeId,
      dto.emoji,
      { usuarioId: ctx.usuarioId, rol: ctx.rol! },
    );
  }

  @Post(':id/media')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: LIMITE_MULTER_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        archivo: { type: 'string', format: 'binary' },
        caption: { type: 'string' },
        respondeAMensajeId: { type: 'string', format: 'uuid' },
        esVoz: { type: 'string', description: '"1" para nota de voz (ogg)' },
      },
      required: ['archivo'],
    },
  })
  @ApiOperation({
    summary: 'Enviar un archivo (imagen, video, audio o documento)',
    description:
      'Solo funciona dentro de la ventana de 24h (igual que el texto libre) — fuera de ella, WhatsApp solo permite ' +
      'plantillas aprobadas, sin archivos. Sube el archivo a Meta, lo envía, y guarda una copia propia para poder ' +
      'mostrarlo después en el historial (el media_id de Meta no dura para siempre).',
  })
  @ApiResponse({ status: 204, description: 'Archivo enviado.' })
  @ApiResponse({
    status: 400,
    description:
      'Archivo faltante, tipo no soportado por WhatsApp, tamaño excedido, o fuera de la ventana de 24h.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({ status: 403, description: 'Módulo WHATSAPP no activo.' })
  @ApiResponse({
    status: 404,
    description:
      'La conversación no existe o el rol no puede escribir en ella.',
  })
  sendMedia(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Body() dto: SubirMediaDto,
  ) {
    if (!archivo) {
      throw new BadRequestException('Falta el archivo');
    }
    const esVoz =
      dto.esVoz === '1' ||
      dto.esVoz === 'true' ||
      dto.esVoz === 'True';
    return this.enviarMedia.execute(
      ctx.organizacionId!,
      id,
      {
        buffer: archivo.buffer,
        mimeType: archivo.mimetype,
        nombreArchivo: archivo.originalname,
        caption: dto.caption,
        respondeAMensajeId: dto.respondeAMensajeId,
        esVoz,
      },
      { usuarioId: ctx.usuarioId, rol: ctx.rol! },
    );
  }

  @Post(':id/location')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Enviar una ubicación (coordenadas)',
    description:
      'Solo funciona dentro de la ventana de 24h — WhatsApp no tiene plantilla equivalente para ubicaciones.',
  })
  @ApiResponse({ status: 204, description: 'Ubicación enviada.' })
  @ApiResponse({
    status: 400,
    description: 'Coordenadas inválidas, o fuera de la ventana de 24h.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({ status: 403, description: 'Módulo WHATSAPP no activo.' })
  @ApiResponse({
    status: 404,
    description:
      'La conversación no existe o el rol no puede escribir en ella.',
  })
  sendLocation(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnviarUbicacionDto,
  ) {
    return this.enviarUbicacion.execute(ctx.organizacionId!, id, dto, {
      usuarioId: ctx.usuarioId,
      rol: ctx.rol!,
    });
  }

  @Post(':id/contact')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Enviar una tarjeta de contacto (vCard)',
    description:
      'Uno o más contactos en un mismo mensaje. Solo funciona dentro de la ventana de 24h.',
  })
  @ApiResponse({ status: 204, description: 'Contacto(s) enviado(s).' })
  @ApiResponse({
    status: 400,
    description:
      'Falta el nombre/teléfono de algún contacto, o fuera de la ventana de 24h.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({ status: 403, description: 'Módulo WHATSAPP no activo.' })
  @ApiResponse({
    status: 404,
    description:
      'La conversación no existe o el rol no puede escribir en ella.',
  })
  sendContact(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnviarContactoDto,
  ) {
    return this.enviarContacto.execute(
      ctx.organizacionId!,
      id,
      { contactos: dto.contactos, respondeAMensajeId: dto.respondeAMensajeId },
      { usuarioId: ctx.usuarioId, rol: ctx.rol! },
    );
  }

  @Post(':id/interactive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Enviar un mensaje interactivo',
    description:
      'Un solo endpoint para los 4 subtipos que soporta Meta: "button" (hasta 3 botones de respuesta rápida), ' +
      '"list" (hasta 10 opciones), "cta_url" (botón con link) y "location_request" (botón que abre el picker de ' +
      'ubicación del contacto). Solo funciona dentro de la ventana de 24h.',
  })
  @ApiResponse({ status: 204, description: 'Mensaje interactivo enviado.' })
  @ApiResponse({
    status: 400,
    description:
      'Faltan campos del subtipo elegido, o fuera de la ventana de 24h.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({ status: 403, description: 'Módulo WHATSAPP no activo.' })
  @ApiResponse({
    status: 404,
    description:
      'La conversación no existe o el rol no puede escribir en ella.',
  })
  sendInteractive(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnviarInteractivoDto,
  ) {
    return this.enviarInteractivo.execute(ctx.organizacionId!, id, dto, {
      usuarioId: ctx.usuarioId,
      rol: ctx.rol!,
    });
  }

  @Post(':id/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bloquear contacto en WhatsApp (block_users)' })
  @ApiResponse({ status: 204, description: 'Contacto bloqueado.' })
  blockContact(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bloquearContacto.execute(ctx.organizacionId!, id, true, {
      usuarioId: ctx.usuarioId,
      rol: ctx.rol!,
    });
  }

  @Delete(':id/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desbloquear contacto en WhatsApp' })
  @ApiResponse({ status: 204, description: 'Contacto desbloqueado.' })
  unblockContact(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bloquearContacto.execute(ctx.organizacionId!, id, false, {
      usuarioId: ctx.usuarioId,
      rol: ctx.rol!,
    });
  }

  @Post(':id/messages/forward')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reenviar uno o varios mensajes a otro chat',
    description:
      `Hasta ${MAX_MENSAJES_REENVIAR} mensajes (tope multi-forward típico de WhatsApp). ` +
      'La Cloud API no tiene forward nativo: se reenvía el contenido en orden (ventana 24h).',
  })
  @ApiResponse({ status: 200, description: 'Resultado del lote (enviados + fallidos parciales).' })
  forwardMessages(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReenviarMensajesLoteDto,
  ) {
    return this.reenviarMensaje.executeLote(
      ctx.organizacionId!,
      id,
      dto.mensajeIds,
      dto.conversacionDestinoId,
      { usuarioId: ctx.usuarioId, rol: ctx.rol! },
    );
  }

  @Post(':id/messages/:mensajeId/forward')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reenviar un mensaje a otro chat',
    description:
      'Compat. Preferir POST …/messages/forward con mensajeIds. Cloud API sin forward nativo.',
  })
  @ApiResponse({ status: 204, description: 'Mensaje reenviado.' })
  forwardMessage(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mensajeId', ParseUUIDPipe) mensajeId: string,
    @Body() dto: ReenviarMensajeDto,
  ) {
    return this.reenviarMensaje.execute(
      ctx.organizacionId!,
      id,
      mensajeId,
      dto.conversacionDestinoId,
      { usuarioId: ctx.usuarioId, rol: ctx.rol! },
    );
  }

  @Delete(':id/messages/:mensajeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar mensaje del CRM',
    description:
      'Soft-delete local. Meta Cloud API no permite "borrar para todos" desde la API; ' +
      'si el contacto o la app Business borran, el webhook de revoke sí se sincroniza aquí.',
  })
  @ApiResponse({ status: 204, description: 'Mensaje marcado como eliminado.' })
  deleteMessage(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mensajeId', ParseUUIDPipe) mensajeId: string,
  ) {
    return this.eliminarMensajeCrm.execute(
      ctx.organizacionId!,
      id,
      mensajeId,
      { usuarioId: ctx.usuarioId, rol: ctx.rol! },
    );
  }

  @Post(':id/typing')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Mostrar "escribiendo…" en el WhatsApp del contacto',
    description:
      'Le confirma a Meta la lectura del último mensaje del contacto (check azul) y le pide mostrar el ' +
      'indicador de "escribiendo…" — dura hasta 25s o hasta que se le mande un mensaje, lo que pase primero. ' +
      'Pensado para llamarse mientras el usuario escribe en el composer, no en cada tecla.',
  })
  @ApiResponse({
    status: 204,
    description: 'Indicador enviado (o no hay nada que marcar todavía).',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({ status: 403, description: 'Módulo WHATSAPP no activo.' })
  async typing(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    // Ídem: efecto de UX, nunca debe devolver un error que el front tenga
    // que manejar mientras alguien solo está escribiendo un mensaje.
    await this.marcarLeidoWhatsApp
      .execute(ctx.organizacionId!, id, { escribiendo: true })
      .catch(() => undefined);
  }

  @Get(':id/messages/:mensajeId/media')
  @ApiParam({ name: 'id', description: 'Id de la conversación' })
  @ApiParam({ name: 'mensajeId', description: 'Id del mensaje con archivo' })
  @ApiOperation({
    summary: 'Descargar el archivo de un mensaje',
    description:
      'Sirve los bytes guardados del archivo (entrante o saliente). Entrante: descargado de Meta apenas llegó el ' +
      'webhook, porque la referencia de Meta solo dura 7 días. Saliente: guardado al momento de enviarlo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Bytes del archivo, con el Content-Type real.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({ status: 403, description: 'Módulo WHATSAPP no activo.' })
  @ApiResponse({
    status: 404,
    description: 'La conversación, el mensaje, o el archivo no existen.',
  })
  async getMedia(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mensajeId', ParseUUIDPipe) mensajeId: string,
    @Res() res: Response,
  ): Promise<void> {
    const media = await this.obtenerMedia.execute(
      ctx.organizacionId!,
      id,
      mensajeId,
      { usuarioId: ctx.usuarioId, rol: ctx.rol! },
    );
    res.set({
      'Content-Type': media.mimeType,
      'Content-Disposition': media.nombreArchivo
        ? `inline; filename="${encodeURIComponent(media.nombreArchivo)}"`
        : 'inline',
      'Cache-Control': 'private, max-age=86400',
    });
    res.send(media.bytes);
  }
}
