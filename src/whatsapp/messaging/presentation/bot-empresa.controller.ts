import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, Min } from 'class-validator';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../../shared/presentation/guards/org-membership.guard';
import { PermisosGuard } from '../../../shared/presentation/guards/permisos.guard';
import { RequirePermission } from '../../../shared/presentation/decorators/require-permission.decorator';
import { ModuleGuard } from '../../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../../shared/presentation/decorators/require-module.decorator';
import { BotEmpresaService } from '../application/bot-empresa.service';

class PreferenciasBotDto {
  @IsIn(['HUMANO', 'BOT']) modoInicial!: 'HUMANO' | 'BOT';
  @IsInt() @Min(0) preferenciasVersion!: number;
}

@RequirePermission('chats.ver', 'bot.configurar')
@Controller('whatsapp/bot/preferencias')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, ModuleGuard, PermisosGuard)
@RequireModule('WHATSAPP')
export class BotEmpresaController {
  constructor(private readonly bot: BotEmpresaService) {}
  @Get() obtener(@CurrentUser() ctx: RequestContext) {
    return this.bot.obtener(ctx.organizacionId!);
  }
  @Patch()
  @RequirePermission('bot.configurar')
  actualizar(
    @CurrentUser() ctx: RequestContext,
    @Body() dto: PreferenciasBotDto,
  ) {
    return this.bot.actualizar(ctx.organizacionId!, ctx.usuarioId, dto);
  }
}
