import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TokenEncryptionService } from './token-encryption.service';

@Global()
@Module({
  providers: [PrismaService, TokenEncryptionService],
  exports: [PrismaService, TokenEncryptionService],
})
export class PrismaModule {}
