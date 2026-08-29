import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { USUARIOS_REPOSITORY } from '../ports/usuarios.repository.port';
import type { UsuariosRepository } from '../ports/usuarios.repository.port';
import { ORGANIZACION_USUARIOS_REPOSITORY } from '../ports/organizacion-usuarios.repository.port';
import type { OrganizacionUsuariosRepository } from '../ports/organizacion-usuarios.repository.port';
import { PASSWORD_HASHER } from '../ports/password-hasher.port';
import type { PasswordHasher } from '../ports/password-hasher.port';
import { TOKEN_SERVICE } from '../ports/token.service.port';
import type { TokenService } from '../ports/token.service.port';
import { TOKENS_REFRESCO_REPOSITORY } from '../ports/tokens-refresco.repository.port';
import type { TokensRefrescoRepository } from '../ports/tokens-refresco.repository.port';

export interface LoginInput {
  email: string;
  password: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORY) private readonly usuarios: UsuariosRepository,
    @Inject(ORGANIZACION_USUARIOS_REPOSITORY)
    private readonly membresias: OrganizacionUsuariosRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    @Inject(TOKENS_REFRESCO_REPOSITORY)
    private readonly tokensRefresco: TokensRefrescoRepository,
  ) {}

  async execute(input: LoginInput) {
    const usuario = await this.usuarios.findActivoByEmail(input.email);
    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValida = await this.hasher.compare(
      input.password,
      usuario.passwordHash,
    );
    if (!passwordValida) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const membresiasActivas = await this.membresias.findMembresiasActivas(
      usuario.id,
    );
    // MVP: si el usuario pertenece a más de una organización se activa la primera;
    // no existe todavía un endpoint de "elegir organización" (PLAN.md §5.1).
    const activa = membresiasActivas[0];

    await this.usuarios.actualizarUltimoLogin(usuario.id);

    const accessToken = this.tokens.firmarAccessToken({
      sub: usuario.id,
      organizacionId: activa?.organizacionId,
      rol: activa?.rol,
      esAdminPlataforma: usuario.esAdminPlataforma === 1,
    });

    const refresh = this.tokens.firmarRefreshToken({
      sub: usuario.id,
      organizacionId: activa?.organizacionId,
    });

    await this.tokensRefresco.crear({
      usuarioId: usuario.id,
      tokenHash: refresh.tokenHash,
      expiraEn: refresh.expiraEn,
      ip: input.ip,
      userAgent: input.userAgent,
    });

    return {
      accessToken,
      refreshToken: refresh.token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        esAdminPlataforma: usuario.esAdminPlataforma === 1,
      },
      organizacion: activa
        ? {
            id: activa.organizacionId,
            nombre: activa.organizacionNombre,
            slug: activa.organizacionSlug,
          }
        : null,
      rol: activa?.rol ?? null,
    };
  }
}
