import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../shared/infrastructure/prisma.service';
import { PrismaNotificacionesRepository } from './prisma-notificaciones.repository';

const connection = process.env.NOTIFICATIONS_TEST_DATABASE_URL;
if (
  connection &&
  !['localhost', '127.0.0.1'].includes(new URL(connection).hostname)
) {
  throw new Error('Las pruebas de notificaciones requieren PostgreSQL local');
}

// Solo tablas temporales: no lee ni modifica notificaciones reales.
(connection ? describe : describe.skip)(
  'Notificaciones agrupadas con PostgreSQL',
  () => {
    let db: PrismaClient;
    beforeAll(() => {
      db = new PrismaClient({ datasourceUrl: connection });
    });
    afterAll(async () => {
      await db?.$disconnect();
    });

    it('agrupa antes de paginar, conserva el último mensaje y cuenta chats pendientes por usuario y organización', async () => {
      await db.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(`CREATE TEMP TABLE notificaciones (
        id uuid PRIMARY KEY, tipo text, titulo text, mensaje text, payload jsonb
      ) ON COMMIT DROP`);
          await tx.$executeRawUnsafe(`CREATE TEMP TABLE notificaciones_usuario (
        id uuid PRIMARY KEY, notificacion_id uuid, organizacion_id uuid,
        usuario_id uuid, estado smallint, leida smallint,
        fecha_creacion timestamptz, fecha_lectura timestamptz
      ) ON COMMIT DROP`);
          const org = randomUUID();
          const user = randomUUID();
          let minuto = 0;
          async function aviso(
            tipo: string,
            chat: unknown,
            leida = 0,
            usuario = user,
            organizacion = org,
            estado = 1,
          ) {
            const id = randomUUID();
            const fecha = new Date(Date.UTC(2026, 9, 30, 12, minuto++));
            await tx.$executeRaw`INSERT INTO notificaciones VALUES (
          ${id}::uuid, ${tipo}, 'Ana', ${`mensaje ${minuto}`},
          ${JSON.stringify({ whatsappConversacionId: chat })}::jsonb
        )`;
            await tx.$executeRaw`INSERT INTO notificaciones_usuario VALUES (
          ${id}::uuid, ${id}::uuid, ${organizacion}::uuid, ${usuario}::uuid,
          ${estado}, ${leida}, ${fecha}, NULL
        )`;
            return id;
          }
          await aviso('WHATSAPP_MENSAJE', 'chat-a');
          await aviso('WHATSAPP_MENSAJE', 'chat-a');
          const ultimo = await aviso('WHATSAPP_MENSAJE', 'chat-a', 1);
          await aviso('WHATSAPP_MENSAJE', 'chat-b', 1);
          await aviso('LEAD_NUEVO', 'chat-a');
          await aviso('LEAD_NUEVO', 'chat-a');
          await aviso('WHATSAPP_MENSAJE', null);
          await aviso('WHATSAPP_MENSAJE', null);
          await aviso('WHATSAPP_MENSAJE', '');
          await aviso('WHATSAPP_MENSAJE', '');
          await aviso('WHATSAPP_MENSAJE', 42);
          await aviso('WHATSAPP_MENSAJE', 'chat-a', 0, randomUUID());
          await aviso('WHATSAPP_MENSAJE', 'chat-a', 0, user, randomUUID());
          await aviso('WHATSAPP_MENSAJE', 'inactivo', 0, user, org, 0);
          const repo = new PrismaNotificacionesRepository(
            tx as unknown as PrismaService,
          );
          const listado = await repo.listarPorUsuario(org, user, 1, 20);
          expect(listado.total).toBe(9);
          expect(listado.data).toHaveLength(9);
          expect(listado.data.find((n) => n.id === ultimo)).toMatchObject({
            mensaje: 'mensaje 3',
            leida: false,
            cantidadNoLeidas: 2,
            fechaLectura: null,
          });
          expect(await repo.contarNoLeidas(org, user)).toBe(8);
          const paginas = await Promise.all(
            [1, 2, 3].map((page) => repo.listarPorUsuario(org, user, page, 3)),
          );
          expect(paginas.flatMap((p) => p.data.map((n) => n.id))).toEqual(
            listado.data.map((n) => n.id),
          );
          expect(paginas[0].totalPages).toBe(3);
          await tx.$executeRaw`UPDATE notificaciones_usuario SET leida = 1`;
          expect(await repo.contarNoLeidas(org, user)).toBe(0);
          expect(
            (await repo.listarPorUsuario(org, user, 1, 20)).data.every(
              (n) => n.leida,
            ),
          ).toBe(true);
          expect(
            (await repo.listarPorUsuario(org, randomUUID(), 1, 20)).total,
          ).toBe(0);
        },
        { timeout: 15_000 },
      );
    });
  },
);
