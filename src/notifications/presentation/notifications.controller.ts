import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../../shared/presentation/guards/org-membership.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import { WsTicketService } from '../infrastructure/ws-ticket.service';
import { ListarNotificacionesUseCase } from '../application/use-cases/listar-notificaciones.use-case';
import { ContarNoLeidasUseCase } from '../application/use-cases/contar-no-leidas.use-case';
import { MarcarLeidaUseCase } from '../application/use-cases/marcar-leida.use-case';
import { MarcarTodasLeidasUseCase } from '../application/use-cases/marcar-todas-leidas.use-case';
import { RegistrarSuscripcionPushUseCase } from '../application/use-cases/registrar-suscripcion-push.use-case';
import { EliminarSuscripcionPushUseCase } from '../application/use-cases/eliminar-suscripcion-push.use-case';
import { ListarNotificacionesQueryDto } from './dto/listar-notificaciones.query.dto';
import {
  EliminarSuscripcionPushDto,
  SuscripcionPushDto,
} from './dto/suscripcion-push.dto';
import { PUSH_SENDER } from '../application/ports/push-sender.port';
import type { PushSender } from '../application/ports/push-sender.port';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class NotificationsController {
  constructor(
    private readonly wsTicket: WsTicketService,
    private readonly listarNotificaciones: ListarNotificacionesUseCase,
    private readonly contarNoLeidas: ContarNoLeidasUseCase,
    private readonly marcarLeida: MarcarLeidaUseCase,
    private readonly marcarTodasLeidas: MarcarTodasLeidasUseCase,
    private readonly registrarPush: RegistrarSuscripcionPushUseCase,
    private readonly eliminarPush: EliminarSuscripcionPushUseCase,
    @Inject(PUSH_SENDER) private readonly pushSender: PushSender,
  ) {}

  @Post('socket-ticket')
  @ApiOperation({
    summary: 'Emitir un ticket de socket',
    description:
      'JWT de vida muy corta (60s) para autenticar el handshake del WebSocket de notificaciones ' +
      '(namespace /notifications) sin depender de la cookie httpOnly, que no viaja cross-site. El front lo pide justo antes de conectar/reconectar.',
  })
  @ApiResponse({ status: 201, description: 'Ticket emitido.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  emitirTicket(@CurrentUser() ctx: RequestContext) {
    return { ticket: this.wsTicket.emitir(ctx.usuarioId, ctx.organizacionId!) };
  }

  @Get('push/vapid-public-key')
  @ApiOperation({
    summary: 'Clave pública VAPID',
    description:
      'Para suscribir el Service Worker a Web Push. Si push no está configurado, enabled=false.',
  })
  vapidPublicKey() {
    const key = this.pushSender.publicKey();
    return { enabled: Boolean(key), publicKey: key };
  }

  @Post('push/subscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registrar suscripción Web Push de este dispositivo' })
  async subscribePush(
    @CurrentUser() ctx: RequestContext,
    @Body() body: SuscripcionPushDto,
  ) {
    const { id } = await this.registrarPush.execute({
      organizacionId: ctx.organizacionId!,
      usuarioId: ctx.usuarioId,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: body.userAgent,
    });
    return { id };
  }

  @Delete('push/subscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desactivar suscripción Web Push de este dispositivo' })
  async unsubscribePush(
    @CurrentUser() ctx: RequestContext,
    @Body() body: EliminarSuscripcionPushDto,
  ) {
    await this.eliminarPush.execute(ctx.usuarioId, body.endpoint);
    return { ok: true };
  }

  @Get()
  @ApiOperation({
    summary: 'Listar notificaciones',
    description:
      'Historial paginado de notificaciones del usuario en la organización activa, más recientes primero.',
  })
  @ApiResponse({ status: 200, description: 'Página de notificaciones.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  findAll(
    @CurrentUser() ctx: RequestContext,
    @Query() query: ListarNotificacionesQueryDto,
  ) {
    return this.listarNotificaciones.execute(
      ctx.organizacionId!,
      ctx.usuarioId,
      query.page,
      query.pageSize,
    );
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Conteo de no leídas',
    description: 'Para el badge numérico de la campanita de notificaciones.',
  })
  @ApiResponse({
    status: 200,
    description: 'Conteo de notificaciones no leídas.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  unreadCount(@CurrentUser() ctx: RequestContext) {
    return this.contarNoLeidas
      .execute(ctx.organizacionId!, ctx.usuarioId)
      .then((count) => ({ count }));
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  @ApiResponse({ status: 200, description: 'Notificación marcada como leída.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 404,
    description: 'La notificación no existe o no pertenece al usuario.',
  })
  async read(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.marcarLeida.execute(ctx.organizacionId!, ctx.usuarioId, id);
    return { ok: true };
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leídas' })
  @ApiResponse({
    status: 200,
    description: 'Cantidad de notificaciones marcadas como leídas.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  async readAll(@CurrentUser() ctx: RequestContext) {
    const count = await this.marcarTodasLeidas.execute(
      ctx.organizacionId!,
      ctx.usuarioId,
    );
    return { count };
  }
}
