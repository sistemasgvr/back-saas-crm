import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../../shared/presentation/guards/org-membership.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import { WsTicketService } from '../infrastructure/ws-ticket.service';
import { ListarNotificacionesUseCase } from '../application/use-cases/listar-notificaciones.use-case';
import { ContarNoLeidasUseCase } from '../application/use-cases/contar-no-leidas.use-case';
import { MarcarLeidaUseCase } from '../application/use-cases/marcar-leida.use-case';
import { MarcarTodasLeidasUseCase } from '../application/use-cases/marcar-todas-leidas.use-case';
import { ListarNotificacionesQueryDto } from './dto/listar-notificaciones.query.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class NotificationsController {
  constructor(
    private readonly wsTicket: WsTicketService,
    private readonly listarNotificaciones: ListarNotificacionesUseCase,
    private readonly contarNoLeidas: ContarNoLeidasUseCase,
    private readonly marcarLeida: MarcarLeidaUseCase,
    private readonly marcarTodasLeidas: MarcarTodasLeidasUseCase,
  ) {}

  @Post('socket-ticket')
  emitirTicket(@CurrentUser() ctx: RequestContext) {
    return { ticket: this.wsTicket.emitir(ctx.usuarioId, ctx.organizacionId!) };
  }

  @Get()
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
  unreadCount(@CurrentUser() ctx: RequestContext) {
    return this.contarNoLeidas
      .execute(ctx.organizacionId!, ctx.usuarioId)
      .then((count) => ({ count }));
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  async read(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.marcarLeida.execute(ctx.organizacionId!, ctx.usuarioId, id);
    return { ok: true };
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  async readAll(@CurrentUser() ctx: RequestContext) {
    const count = await this.marcarTodasLeidas.execute(
      ctx.organizacionId!,
      ctx.usuarioId,
    );
    return { count };
  }
}
