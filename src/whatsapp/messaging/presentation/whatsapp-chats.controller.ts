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
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../../shared/presentation/guards/org-membership.guard';
import { ModuleGuard } from '../../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../../shared/presentation/decorators/require-module.decorator';
import { ListarConversacionesUseCase } from '../application/use-cases/listar-conversaciones.use-case';
import { ObtenerConversacionUseCase } from '../application/use-cases/obtener-conversacion.use-case';
import { EnviarMensajeWhatsAppUseCase } from '../application/use-cases/enviar-mensaje-whatsapp.use-case';
import { ListarPlantillasUseCase } from '../application/use-cases/listar-plantillas.use-case';
import { IniciarConversacionDesdeLeadUseCase } from '../application/use-cases/iniciar-conversacion-desde-lead.use-case';
import { EnviarMensajeDto } from './dto/enviar-mensaje.dto';

@Controller('whatsapp/chats')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, ModuleGuard)
@RequireModule('WHATSAPP')
export class WhatsappChatsController {
  constructor(
    private readonly listarConversaciones: ListarConversacionesUseCase,
    private readonly obtenerConversacion: ObtenerConversacionUseCase,
    private readonly enviarMensaje: EnviarMensajeWhatsAppUseCase,
    private readonly listarPlantillas: ListarPlantillasUseCase,
    private readonly iniciarDesdeLead: IniciarConversacionDesdeLeadUseCase,
  ) {}

  @Get()
  findAll(@CurrentUser() ctx: RequestContext) {
    return this.listarConversaciones.execute(ctx.organizacionId!, {
      usuarioId: ctx.usuarioId,
      rol: ctx.rol!,
    });
  }

  @Get('templates')
  templates(@CurrentUser() ctx: RequestContext) {
    return this.listarPlantillas.execute(ctx.organizacionId!);
  }

  @Post('start-from-lead/:leadId')
  startFromLead(
    @CurrentUser() ctx: RequestContext,
    @Param('leadId', ParseUUIDPipe) leadId: string,
  ) {
    return this.iniciarDesdeLead.execute(ctx.organizacionId!, leadId);
  }

  @Get(':id')
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
