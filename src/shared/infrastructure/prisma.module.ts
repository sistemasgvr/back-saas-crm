import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TokenEncryptionService } from './token-encryption.service';
import { AutomatizacionesIntegracionService } from './automatizaciones-integracion.service';

@Global()
@Module({
  providers: [
    PrismaService,
    TokenEncryptionService,
    AutomatizacionesIntegracionService,
  ],
  exports: [
    PrismaService,
    TokenEncryptionService,
    AutomatizacionesIntegracionService,
  ],
})
export class PrismaModule {}
