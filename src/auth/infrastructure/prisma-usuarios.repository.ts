import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { UsuariosRepository } from '../application/ports/usuarios.repository.port';

@Injectable()
export class PrismaUsuariosRepository implements UsuariosRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActivoByEmail(email: string) {
    return this.prisma.usuario.findFirst({ where: { email, estado: 1 } });
  }

  findActivoById(id: string) {
    return this.prisma.usuario.findFirst({ where: { id, estado: 1 } });
  }

  async actualizarUltimoLogin(id: string): Promise<void> {
    await this.prisma.usuario.update({ where: { id }, data: { ultimoLogin: new Date() } });
  }
}
