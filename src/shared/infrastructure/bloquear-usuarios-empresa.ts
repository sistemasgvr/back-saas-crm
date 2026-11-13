import type { Prisma } from '@prisma/client';

export async function bloquearUsuariosEmpresa(
  tx: Prisma.TransactionClient,
  organizacionId: string,
) {
  const clave = `org-usuarios:${organizacionId.toLowerCase()}`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clave}, 0))::text`;
}
