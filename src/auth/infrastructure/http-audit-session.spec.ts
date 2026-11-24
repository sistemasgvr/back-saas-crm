import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { RefreshUseCase } from '../application/use-cases/refresh.use-case';
import { JwtTokenService } from './jwt-token.service';
import { JwtAccessStrategy } from './jwt-access.strategy';
import type { AccessTokenPayload } from '../domain/jwt-payload.interface';
import type { UsuariosRepository } from '../application/ports/usuarios.repository.port';
import type { PasswordHasher } from '../application/ports/password-hasher.port';
import type {
  CrearTokenRefrescoInput,
  TokensRefrescoRepository,
} from '../application/ports/tokens-refresco.repository.port';

it('la sesión de login se conserva en access, refresh rotado y contexto de auditoría', async () => {
  const config = new ConfigService({
    JWT_ACCESS_SECRET: 'synthetic-access-key-for-audit',
    JWT_REFRESH_SECRET: 'synthetic-refresh-key-for-audit',
  });
  const jwt = new JwtService();
  const tokens = new JwtTokenService(jwt, config);
  const usuario = {
    id: '11111111-1111-4111-8111-111111111111',
    esAdminPlataforma: 0,
    debeCambiarPassword: 0,
  };
  const usuarios = {
    findActivoByEmail: jest.fn().mockResolvedValue(usuario),
    actualizarUltimoLogin: jest.fn(),
    findActivoById: jest.fn().mockResolvedValue(usuario),
  };
  const miembro = {
    organizacionId: '22222222-2222-4222-8222-222222222222',
    rol: 'USUARIO',
  };
  const miembros = {
    findMembresiasActivas: jest.fn().mockResolvedValue([miembro]),
    findMembresiaActiva: jest.fn().mockResolvedValue(miembro),
  };
  const repositorio = {
    crear: jest
      .fn<Promise<void>, [CrearTokenRefrescoInput]>()
      .mockResolvedValue(undefined),
    findVigentePorHash: jest.fn(),
    rotar: jest.fn().mockResolvedValue(true),
  };
  const login = new LoginUseCase(
    usuarios as unknown as UsuariosRepository,
    miembros,
    { compare: () => Promise.resolve(true) } as unknown as PasswordHasher,
    tokens,
    repositorio as unknown as TokensRefrescoRepository,
  );
  const resultado = await login.execute({
    email: 'synthetic@example.test',
    password: 'not-recorded',
  });
  const sesion = tokens.verificarRefreshToken(resultado.refreshToken)!.sesionId;
  const payload = jwt.verify<AccessTokenPayload>(resultado.accessToken, {
    secret: config.get('JWT_ACCESS_SECRET'),
  });
  expect(payload.sesionId).toBe(sesion);
  expect(repositorio.crear.mock.calls[0][0].familiaId).toBe(sesion);
  expect(new JwtAccessStrategy(config).validate(payload).sesionId).toBe(sesion);
  repositorio.findVigentePorHash.mockResolvedValue({
    id: 'token-row',
    familiaId: sesion,
  });
  const refresh = new RefreshUseCase(
    tokens,
    repositorio as unknown as TokensRefrescoRepository,
    usuarios as unknown as UsuariosRepository,
    miembros,
  );
  const rotado = await refresh.execute({
    refreshToken: resultado.refreshToken,
  });
  expect(jwt.decode<AccessTokenPayload>(rotado.accessToken).sesionId).toBe(
    sesion,
  );
  expect(tokens.verificarRefreshToken(rotado.refreshToken)!.sesionId).toBe(
    sesion,
  );
});
