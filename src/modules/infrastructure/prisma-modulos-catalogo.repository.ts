import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import type {
  ActualizarModuloInput,
  CrearModuloInput,
  ModulosCatalogoRepository,
} from '../application/ports/modulos-catalogo.repository.port';

@Injectable()
export class PrismaModulosCatalogoRepository implements ModulosCatalogoRepository {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.modulo.findMany({
      where: { estado: 1 },
      orderBy: { orden: 'asc' },
    });
  }

  obtenerPorId(id: string) {
    return this.prisma.modulo.findUnique({ where: { id } });
  }

  obtenerPorCodigo(codigo: string) {
    return this.prisma.modulo.findUnique({ where: { codigo } });
  }

  crear(input: CrearModuloInput, usuarioCreacion: string) {
    return this.prisma.modulo.create({
      data: { ...input, usuarioCreacion },
    });
  }

  actualizar(id: string, input: ActualizarModuloInput, usuarioEdicion: string) {
    return this.prisma.modulo.update({
      where: { id },
      data: { ...input, usuarioEdicion },
    });
  }

  cambiarEstado(id: string, estado: 0 | 1, usuarioEdicion: string) {
    return this.prisma.modulo.update({
      where: { id },
      data: { estado, usuarioEdicion },
    });
  }
}
