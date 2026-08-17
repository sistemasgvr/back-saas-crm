import { Inject, Injectable } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../ports/meta-conexiones.repository.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { toConexionResponse } from '../conexion-response.mapper';

@Injectable()
export class GuardarCredencialesAppUseCase {
  constructor(
    @Inject(META_CONEXIONES_REPOSITORY) private readonly conexiones: MetaConexionesRepository,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(organizacionId: string, appId: string, appSecret: string, usuarioEdicion: string) {
    const conexion = await this.conexiones.guardarCredencialesApp({
      organizacionId,
      appId,
      appSecretCifrado: this.tokenEncryption.encrypt(appSecret),
      usuarioEdicion,
    });
    return toConexionResponse(conexion);
  }
}
