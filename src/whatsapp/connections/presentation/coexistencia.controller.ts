import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../../shared/presentation/guards/org-membership.guard';
import { RolesGuard } from '../../../shared/presentation/guards/roles.guard';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import { ModuleGuard } from '../../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../../shared/presentation/decorators/require-module.decorator';
import { CoexistenciaService } from '../application/coexistencia.service';

class CodigoDto {
  @IsString() @MinLength(1) @MaxLength(4096) code!: string;
  // Opcional: la guía oficial de Embedded Signup intercambia el code sin redirect_uri.
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8192)
  redirectUri?: string;
}
class CompletarDto {
  @IsUUID() sessionId!: string;
  @Matches(/^\d{1,64}$/) wabaId!: string;
  @IsOptional() @Matches(/^\d{1,64}$/) phoneNumberId?: string;
}

class ConfiguracionDto {
  @Matches(/^\d{1,64}$/) appId!: string;
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @Matches(/^\d{1,64}$/)
  configId!: string | null;
}

@Controller('whatsapp/coexistencia')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, RolesGuard, ModuleGuard)
@Roles('PROPIETARIO', 'ADMINISTRADOR')
@RequireModule('WHATSAPP')
export class CoexistenciaController {
  constructor(private readonly service: CoexistenciaService) {}
  @Get('config') config(@CurrentUser() c: RequestContext) {
    return this.service.configuracion(c.organizacionId!);
  }
  @Patch('config')
  guardarConfig(
    @CurrentUser() c: RequestContext,
    @Body() dto: ConfiguracionDto,
  ) {
    return this.service.guardarConfiguracion(
      c.organizacionId!,
      c.usuarioId,
      dto.appId,
      dto.configId,
    );
  }
  @Post('code') code(@CurrentUser() c: RequestContext, @Body() dto: CodigoDto) {
    return this.service.intercambiar(
      c.organizacionId!,
      c.usuarioId,
      dto.code,
      dto.redirectUri,
    );
  }
  @Post('complete') complete(
    @CurrentUser() c: RequestContext,
    @Body() dto: CompletarDto,
  ) {
    return this.service.completar(
      c.organizacionId!,
      c.usuarioId,
      dto.sessionId,
      dto.wabaId,
      dto.phoneNumberId,
    );
  }
}
