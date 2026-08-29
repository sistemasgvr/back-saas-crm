import type { Modulo } from '@prisma/client';

export const MODULOS_CATALOGO_REPOSITORY = Symbol(
  'MODULOS_CATALOGO_REPOSITORY',
);

export interface CrearModuloInput {
  codigo: string;
  nombre: string;
  descripcion?: string;
  icono?: string;
  orden?: number;
}

export interface ActualizarModuloInput {
  nombre?: string;
  descripcion?: string;
  icono?: string;
  orden?: number;
}

export interface ModulosCatalogoRepository {
  listar(): Promise<Modulo[]>;
  obtenerPorId(id: string): Promise<Modulo | null>;
  obtenerPorCodigo(codigo: string): Promise<Modulo | null>;
  crear(input: CrearModuloInput, usuarioCreacion: string): Promise<Modulo>;
  actualizar(
    id: string,
    input: ActualizarModuloInput,
    usuarioEdicion: string,
  ): Promise<Modulo>;
  cambiarEstado(
    id: string,
    estado: 0 | 1,
    usuarioEdicion: string,
  ): Promise<Modulo>;
}
