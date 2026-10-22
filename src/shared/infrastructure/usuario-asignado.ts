/** Estado de cuenta y membresía: ambos deben estar activos para atender. */
export const USUARIO_ASIGNADO_SELECT = {
  id: true,
  nombre: true,
  apellido: true,
  estado: true,
  organizacionUsuarios: { select: { organizacionId: true, estado: true } },
} as const;

export function referenciaUsuarioAsignado(
  usuario: {
    id: string;
    nombre: string;
    apellido: string | null;
    estado: number;
    organizacionUsuarios: { organizacionId: string; estado: number }[];
  } | null,
  organizacionId: string,
) {
  if (!usuario) return null;
  return {
    id: usuario.id,
    nombre: [usuario.nombre, usuario.apellido].filter(Boolean).join(' '),
    activo:
      usuario.estado === 1 &&
      usuario.organizacionUsuarios.some(
        (m) => m.organizacionId === organizacionId && m.estado === 1,
      ),
  };
}
