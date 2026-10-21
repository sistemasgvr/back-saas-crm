import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../shared/presentation/guards/platform-admin.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import { WhatsappBotAdminService } from '../application/whatsapp-bot-admin.service';

export class ActualizarWhatsappBotDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  habilitado!: boolean;
  @ApiProperty({ example: 0, minimum: 0 })
  @IsInt()
  @Min(0)
  configVersion!: number;
  @ApiProperty({
    example: 'Activación del piloto',
    minLength: 8,
    maxLength: 500,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  motivo!: string;
}

@ApiTags('Platform Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin/organizations/:organizacionId/whatsapp-bot')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminWhatsappBotController {
  constructor(private readonly bot: WhatsappBotAdminService) {}

  @Get()
  @ApiOperation({
    summary:
      'Estado de habilitación del bot por organización; exclusivo de plataforma',
  })
  obtener(
    @Param('organizacionId', ParseUUIDPipe) org: string,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.bot.obtener(org, ctx.usuarioId);
  }

  @Patch()
  @ApiOperation({
    summary:
      'Habilitar o deshabilitar el bot sin reactivar conversaciones humanas',
  })
  actualizar(
    @Param('organizacionId', ParseUUIDPipe) org: string,
    @CurrentUser() ctx: RequestContext,
    @Body() input: ActualizarWhatsappBotDto,
  ) {
    return this.bot.actualizar(org, ctx.usuarioId, input);
  }

  @Get('historial')
  @ApiOperation({
    summary: 'Auditoría inmutable de cambios de habilitación del bot',
  })
  historial(
    @Param('organizacionId', ParseUUIDPipe) org: string,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.bot.historial(org, ctx.usuarioId);
  }
}
