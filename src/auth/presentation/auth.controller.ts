import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { RefreshUseCase } from '../application/use-cases/refresh.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { MeUseCase } from '../application/use-cases/me.use-case';
import { UpdateMeUseCase } from '../application/use-cases/update-me.use-case';
import { ChangePasswordUseCase } from '../application/use-cases/change-password.use-case';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { RequestContext } from '../domain/request-context.interface';

@ApiTags('Auth')
@Controller()
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly meUseCase: MeUseCase,
    private readonly updateMeUseCase: UpdateMeUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
  ) {}

  @Post('auth/login')
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Valida email + contraseña y emite un access token (JWT corto) y un refresh token ' +
      '(persistido, de vida larga). Registra IP y user-agent para auditoría de sesiones.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Credenciales válidas — devuelve accessToken, refreshToken y el usuario.',
  })
  @ApiResponse({ status: 401, description: 'Email o contraseña incorrectos.' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.loginUseCase.execute({
      email: dto.email,
      password: dto.password,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('auth/refresh')
  @ApiOperation({
    summary: 'Renovar sesión',
    description:
      'Cambia un refresh token vigente por un nuevo par de access/refresh token (rotación).',
  })
  @ApiResponse({
    status: 200,
    description: 'Nuevo accessToken y refreshToken.',
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token inválido, expirado o ya usado.',
  })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.refreshUseCase.execute({
      refreshToken: dto.refreshToken,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('auth/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cerrar sesión',
    description: 'Revoca el refresh token indicado.',
  })
  @ApiResponse({ status: 204, description: 'Sesión cerrada.' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.logoutUseCase.execute(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Perfil del usuario autenticado',
    description:
      'Devuelve el usuario actual junto con su organización activa (si pertenece a una) y su rol.',
  })
  @ApiResponse({ status: 200, description: 'Perfil del usuario.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  me(@CurrentUser() context: RequestContext) {
    return this.meUseCase.execute(context);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Actualizar datos del perfil propio (nombre, apellido, teléfono).',
  })
  @ApiResponse({ status: 200, description: 'Perfil actualizado.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  updateMe(@CurrentUser() context: RequestContext, @Body() dto: UpdateMeDto) {
    return this.updateMeUseCase.execute(context.usuarioId, dto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Cambiar la contraseña propia',
    description: 'Requiere la contraseña actual para confirmar.',
  })
  @ApiResponse({ status: 204, description: 'Contraseña actualizada.' })
  @ApiResponse({
    status: 400,
    description: 'La contraseña actual no coincide.',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  async changePassword(
    @CurrentUser() context: RequestContext,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.changePasswordUseCase.execute(
      context.usuarioId,
      dto.passwordActual,
      dto.passwordNueva,
    );
  }
}
