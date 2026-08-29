import { Usuario } from '@prisma/client';

export const USUARIOS_REPOSITORY = Symbol('USUARIOS_REPOSITORY');

export interface UsuariosRepository {
  findActivoByEmail(email: string): Promise<Usuario | null>;
  findActivoById(id: string): Promise<Usuario | null>;
  actualizarUltimoLogin(id: string): Promise<void>;
  actualizarPerfil(
    id: string,
    data: {
      nombre?: string;
      apellido?: string | null;
      telefono?: string | null;
    },
    usuarioEdicion: string,
  ): Promise<Usuario>;
  actualizarPasswordHash(
    id: string,
    passwordHash: string,
    usuarioEdicion: string,
  ): Promise<void>;
}
