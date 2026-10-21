import type { Prisma } from '@prisma/client';

/** Siempre adquirir este lock antes del lock por conversación. */
export async function lockBotOrganizacion(
  tx: Prisma.TransactionClient,
  organizacionId: string,
) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`wa-bot-org:${organizacionId.toLowerCase()}`}, 0))::text`;
}
