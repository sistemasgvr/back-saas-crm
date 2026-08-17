import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { RolOrganizacion } from '../../domain/request-context.interface';
import { USUARIOS_REPOSITORY } from '../ports/usuarios.repository.port';
import type { UsuariosRepository } from '../ports/usuarios.repository.port';
import { ORGANIZACION_USUARIOS_REPOSITORY } from '../ports/organizacion-usuarios.repository.port';
import type { OrganizacionUsuariosRepository } from '../ports/organizacion-usuarios.repository.port';
import { TOKEN_SERVICE } from '../ports/token.service.port';
import type { TokenService } from '../ports/token.service.port';
import { TOKENS_REFRESCO_REPOSITORY } from '../ports/tokens-refresco.repository.port';
import type { TokensRefrescoRepository } from '../ports/tokens-refresco.repository.port';

export interface RefreshInput {
  refreshToken: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class RefreshUseCase {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    @Inject(TOKENS_REFRESCO_REPOSITORY)
    private readonly tokensRefresco: TokensRefrescoRepository,
    @Inject(USUARIOS_REPOSITORY) private readonly usuarios: UsuariosRepository,
    @Inject(ORGANIZACION_USUARIOS_REPOSITORY)
    private readonly membresias: OrganizacionUsuariosRepository,
  ) {}

  async execute(input: RefreshInput) {
    const payload = this.tokens.verificarRefreshToken(input.refreshToken);
    if (!payload) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const tokenHash = this.tokens.hashToken(input.refreshToken);
    const fila = await this.tokensRefresco.findVigentePorHash(tokenHash);
    if (!fila) {
      throw new UnauthorizedException('Refresh token inválido o revocado');
    }

    const usuario = await this.usuarios.findActivoById(payload.sub);
    if (!usuario) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    let organizacionId: string | undefined;
    let rol: RolOrganizacion | undefined;
    if (payload.organizacionId) {
      const membresia = await this.membresias.findMembresiaActiva(
        usuario.id,
        payload.organizacionId,
      );
      // Si la membresía/org ya no está activa, la sesión continúa sin org activa.
      if (membresia) {
        organizacionId = membresia.organizacionId;
        rol = membresia.rol;
      }
    }

    await this.tokensRefresco.revocar(fila.id);

    const accessToken = this.tokens.firmarAccessToken({
      sub: usuario.id,
      organizacionId,
      rol,
      esAdminPlataforma: usuario.esAdminPlataforma === 1,
    });

    const nuevoRefresh = this.tokens.firmarRefreshToken({ sub: usuario.id, organizacionId });
    await this.tokensRefresco.crear({
      usuarioId: usuario.id,
      tokenHash: nuevoRefresh.tokenHash,
      expiraEn: nuevoRefresh.expiraEn,
      ip: input.ip,
      userAgent: input.userAgent,
    });

    return { accessToken, refreshToken: nuevoRefresh.token };
  }
}
