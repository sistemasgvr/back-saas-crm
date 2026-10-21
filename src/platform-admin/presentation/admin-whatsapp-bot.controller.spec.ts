import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ActualizarWhatsappBotDto,
  AdminWhatsappBotController,
} from './admin-whatsapp-bot.controller';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../shared/presentation/guards/platform-admin.guard';

describe('Contrato HTTP administrativo del bot', () => {
  it('protege todas sus rutas con autenticación y administrador de plataforma', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AdminWhatsappBotController),
    ).toEqual([JwtAuthGuard, PlatformAdminGuard]);
  });
  it('acepta versión entera y motivo recortado', async () => {
    const dto = plainToInstance(ActualizarWhatsappBotDto, {
      habilitado: false,
      configVersion: 2,
      motivo: '  Suspender el piloto  ',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.motivo).toBe('Suspender el piloto');
  });
  it.each([
    { habilitado: 'false', configVersion: 0, motivo: 'Prueba del piloto' },
    { habilitado: true, configVersion: -1, motivo: 'Prueba del piloto' },
    { habilitado: true, configVersion: 1.5, motivo: 'Prueba del piloto' },
    { habilitado: true, configVersion: 0, motivo: '       ' },
    { habilitado: true, configVersion: 0, motivo: 'x'.repeat(501) },
    { habilitado: true, motivo: 'Prueba del piloto' },
  ])('rechaza una petición inválida: %j', async (input) => {
    expect(
      (await validate(plainToInstance(ActualizarWhatsappBotDto, input))).length,
    ).toBeGreaterThan(0);
  });
});
