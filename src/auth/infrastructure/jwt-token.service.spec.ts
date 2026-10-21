import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtTokenService } from './jwt-token.service';

describe('Rotación de refresh tokens', () => {
  it('emite tokens distintos dentro del mismo segundo y conserva la identidad', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(1792590000000);
    try {
      const service = new JwtTokenService(
        new JwtService(),
        new ConfigService({
          JWT_REFRESH_SECRET: 'synthetic-refresh-key-for-regression',
        }),
      );
      const payload = { sub: 'usuario-local', organizacionId: 'empresa-local' };
      const first = service.firmarRefreshToken(payload);
      const second = service.firmarRefreshToken(payload);
      expect(first.token).not.toBe(second.token);
      expect(first.tokenHash).not.toBe(second.tokenHash);
      expect(first.expiraEn).toEqual(second.expiraEn);
      expect(service.verificarRefreshToken(second.token)).toMatchObject(
        payload,
      );
      expect(first.sesionId).not.toBe(second.sesionId);
      const rotated = service.firmarRefreshToken({
        ...payload,
        sesionId: first.sesionId,
      });
      expect(rotated.sesionId).toBe(first.sesionId);
      expect(rotated.token).not.toBe(first.token);
    } finally {
      clock.mockRestore();
    }
  });
});
