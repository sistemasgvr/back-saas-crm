import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../shared/presentation/guards/platform-admin.guard';
import { AutomatizacionesIntegracionService } from '../../shared/infrastructure/automatizaciones-integracion.service';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../auth/domain/request-context.interface';

class IntegracionDto {
  @IsString() @MaxLength(2048) webhookUrl!: string;
  @IsString() @MaxLength(100) headerNombre!: string;
  @IsInt() @Min(0) version!: number;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(4096)
  secreto?: string;
  @IsOptional() @IsBoolean() eliminarSecreto?: boolean;
}

@Controller('admin/automations')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminAutomationsController {
  constructor(
    private readonly integracion: AutomatizacionesIntegracionService,
  ) {}
  @Get('integration') estado() {
    return this.integracion.obtener();
  }
  @Patch('integration') guardar(
    @CurrentUser() ctx: RequestContext,
    @Body() input: IntegracionDto,
  ) {
    return this.integracion.guardar(ctx.usuarioId, input);
  }
}
