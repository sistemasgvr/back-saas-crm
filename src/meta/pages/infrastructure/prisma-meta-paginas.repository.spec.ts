import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../shared/infrastructure/prisma.service';
import { PrismaMetaPaginasRepository } from './prisma-meta-paginas.repository';

describe('PrismaMetaPaginasRepository: conflictos de vinculación', () => {
  it.each([null, { id: 'anterior' }])(
    'traduce la colisión del índice al crear o reactivar (%s)',
    async (existente) => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint',
        {
          code: 'P2002',
          clientVersion: '6.12.0',
        },
      );
      const db = {
        metaPagina: {
          findFirst: jest.fn().mockResolvedValue(existente),
          create: jest.fn().mockRejectedValue(error),
          update: jest.fn().mockRejectedValue(error),
        },
      };
      const repo = new PrismaMetaPaginasRepository(
        db as unknown as PrismaService,
      );
      await expect(
        repo.vincular({
          organizacionId: 'org',
          metaConexionId: 'conexion',
          pageId: 'page',
          nombre: 'Impulsa',
          tokenPaginaCifrado: 'token',
          webhookSuscrito: true,
          usuarioEdicion: 'admin',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    },
  );
});
