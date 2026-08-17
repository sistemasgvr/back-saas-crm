import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req, UseGuards } from '@nestjs/common';
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
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.loginUseCase.execute({
      email: dto.email,
      password: dto.password,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('auth/refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.refreshUseCase.execute({
      refreshToken: dto.refreshToken,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('auth/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.logoutUseCase.execute(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() context: RequestContext) {
    return this.meUseCase.execute(context);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@CurrentUser() context: RequestContext, @Body() dto: UpdateMeDto) {
    return this.updateMeUseCase.execute(context.usuarioId, dto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async changePassword(@CurrentUser() context: RequestContext, @Body() dto: ChangePasswordDto) {
    await this.changePasswordUseCase.execute(context.usuarioId, dto.passwordActual, dto.passwordNueva);
  }
}
