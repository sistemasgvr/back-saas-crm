import type { Prisma } from '@prisma/client';

/** Solo cuentas de cliente que pueden acceder a su empresa consumen cupo. */
export const membresiaQueConsumeCupo = {
  estado: 1,
  usuario: { estado: 1, esAdminPlataforma: 0 },
} satisfies Prisma.OrganizacionUsuarioWhereInput;
