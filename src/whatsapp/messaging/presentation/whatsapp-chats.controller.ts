import {
  BadRequestException,
  Body,
  Controller,
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
import { ObtenerMediaMensajeUseCase } from '../application/use-cases/obtener-media-mensaje.use-case';
import { ListarPlantillasUseCase } from '../application/use-cases/listar-plantillas.use-case';
import { CrearPlantillaUseCase } from '../application/use-cases/crear-plantilla.use-case';
import { IniciarConversacionDesdeLeadUseCase } from '../application/use-cases/iniciar-conversacion-desde-lead.use-case';
import { EnviarMensajeDto } from './dto/enviar-mensaje.dto';
import { EnviarReaccionDto } from './dto/enviar-reaccion.dto';
import { CrearPlantillaDto } from './dto/crear-plantilla.dto';
import { SubirMediaDto } from './dto/subir-media.dto';

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
    private readonly obtenerMedia: ObtenerMediaMensajeUseCase,
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
    return this.enviarMedia.execute(
      ctx.organizacionId!,
      id,
      {
        buffer: archivo.buffer,
        mimeType: archivo.mimetype,
        nombreArchivo: archivo.originalname,
        caption: dto.caption,
      },
      { usuarioId: ctx.usuarioId, rol: ctx.rol! },
    );
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
