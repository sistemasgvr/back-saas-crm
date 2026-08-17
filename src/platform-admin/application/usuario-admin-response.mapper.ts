import type { Usuario } from '@prisma/client';
import type { UsuarioConMembresias } from './ports/usuarios-admin.repository.port';

export function toUsuarioAdminResponse(usuario: Usuario) {
  return {
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    telefono: usuario.telefono,
    esAdminPlataforma: usuario.esAdminPlataforma === 1,
    estado: usuario.estado,
    ultimoLogin: usuario.ultimoLogin,
    fechaCreacion: usuario.fechaCreacion,
  };
}

export function toUsuarioAdminDetalleResponse(usuario: UsuarioConMembresias) {
  return {
    ...toUsuarioAdminResponse(usuario),
    organizaciones: usuario.organizacionUsuarios,
  };
}
