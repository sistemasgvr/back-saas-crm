import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './presentation/auth.controller';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { RefreshUseCase } from './application/use-cases/refresh.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { MeUseCase } from './application/use-cases/me.use-case';
import { USUARIOS_REPOSITORY } from './application/ports/usuarios.repository.port';
import { ORGANIZACION_USUARIOS_REPOSITORY } from './application/ports/organizacion-usuarios.repository.port';
import { MODULOS_REPOSITORY } from './application/ports/modulos.repository.port';
import { TOKENS_REFRESCO_REPOSITORY } from './application/ports/tokens-refresco.repository.port';
import { PASSWORD_HASHER } from './application/ports/password-hasher.port';
import { TOKEN_SERVICE } from './application/ports/token.service.port';
import { PrismaUsuariosRepository } from './infrastructure/prisma-usuarios.repository';
import { PrismaOrganizacionUsuariosRepository } from './infrastructure/prisma-organizacion-usuarios.repository';
import { PrismaModulosRepository } from './infrastructure/prisma-modulos.repository';
import { PrismaTokensRefrescoRepository } from './infrastructure/prisma-tokens-refresco.repository';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { JwtTokenService } from './infrastructure/jwt-token.service';
import { JwtAccessStrategy } from './infrastructure/jwt-access.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    LoginUseCase,
    RefreshUseCase,
    LogoutUseCase,
    MeUseCase,
    JwtAccessStrategy,
    { provide: USUARIOS_REPOSITORY, useClass: PrismaUsuariosRepository },
    { provide: ORGANIZACION_USUARIOS_REPOSITORY, useClass: PrismaOrganizacionUsuariosRepository },
    { provide: MODULOS_REPOSITORY, useClass: PrismaModulosRepository },
    { provide: TOKENS_REFRESCO_REPOSITORY, useClass: PrismaTokensRefrescoRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
  ],
  exports: [PASSWORD_HASHER],
})
export class AuthModule {}
