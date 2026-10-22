/* Prueba manual contra PostgreSQL real. Todos los cambios se revierten.
 * Requiere CUPO_TEST_DATABASE_URL y CUPO_TEST_ORGANIZACION_ID explícitos.
 * Solo admite la empresa vacía con slug organizacion-de-prueba.
 */
require('ts-node/register/transpile-only');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const {
  GestionMembresiasService,
} = require('../src/organizations/application/gestion-membresias.service');
const {
  PrismaUsuariosAdminRepository,
} = require('../src/platform-admin/infrastructure/prisma-usuarios-admin.repository');
const {
  PrismaOrganizacionesAdminRepository,
} = require('../src/platform-admin/infrastructure/prisma-organizaciones-admin.repository');
const {
  membresiaQueConsumeCupo,
} = require('../src/organizations/application/membresia-cupo');

async function main() {
  const url = process.env.CUPO_TEST_DATABASE_URL;
  const org = process.env.CUPO_TEST_ORGANIZACION_ID;
  assert(url && org, 'Faltan las dos variables de prueba explícitas');
  const db = new PrismaClient({ datasourceUrl: url, log: [] });
  const created = [];
  const checks = [];
  const rollback = new Error('ROLLBACK_OBLIGATORIO');
  const snapshot = async () => ({
    empresa: await db.organizacion.findUniqueOrThrow({ where: { id: org } }),
    membresias: await db.organizacionUsuario.findMany({
      where: { organizacionId: org },
      orderBy: { id: 'asc' },
    }),
    eventos: await db.organizacionUsuarioEvento.count({
      where: { organizacionId: org },
    }),
  });
  const service = (client) =>
    new GestionMembresiasService(
      client,
      {
        hash: async () => 'hash-de-prueba-inutilizable',
      },
      {
        liberarPorMembresia: async () => [],
        notificarLiberacionMembresia: () => {},
      },
      { execute: async () => {} },
    );
  const input = () => ({
    email: `cupo-${randomUUID()}@example.invalid`,
    nombre: 'Prueba de cupo temporal',
    password: randomUUID(),
    rol: 'USUARIO',
  });
  try {
    const before = await snapshot();
    assert.equal(before.empresa.slug, 'organizacion-de-prueba');
    assert.equal(before.empresa.estado, 1);
    assert.equal(
      await db.organizacionUsuario.count({
        where: { organizacionId: org, ...membresiaQueConsumeCupo },
      }),
      0,
      'Solo empresa sin usuarios que consuman cupo',
    );
    const actor = await db.usuario.findFirstOrThrow({
      where: { estado: 1, esAdminPlataforma: 1 },
    });
    const ctx = { usuarioId: actor.id, esAdminPlataforma: true };
    try {
      await db.$transaction(
        async (tx) => {
          const client = { ...tx, $transaction: (fn) => fn(tx) };
          const gestion = service(client);
          const usuarios = new PrismaUsuariosAdminRepository(client, gestion);
          const empresas = new PrismaOrganizacionesAdminRepository(client);
          const count = () =>
            tx.organizacionUsuario.count({
              where: { organizacionId: org, ...membresiaQueConsumeCupo },
            });
          const limit = (n) =>
            empresas.actualizar(org, { limiteUsuarios: n }, actor.id);
          const alta = async (contexto = ctx, rol = 'USUARIO') => {
            const u = await gestion.crear(org, { ...input(), rol }, contexto);
            created.push(u.id);
            return u.id;
          };
          const blocked = async (fn, label) => {
            await assert.rejects(
              fn,
              (e) => e.getStatus?.() === 409 && /límite/.test(e.message),
            );
            checks.push(label);
          };
          await limit(null);
          const admin = await alta(ctx, 'ADMINISTRADOR');
          const tenant = { usuarioId: admin, organizacionId: org };
          const u2 = await alta(tenant);
          assert.equal(await count(), 2);
          checks.push('Sin límite: altas SaaS y administrador de empresa');
          await limit(2);
          const denied = input();
          await blocked(
            () => gestion.crear(org, denied, tenant),
            'Alta de empresa bloqueada al llenar cupo',
          );
          assert.equal(
            await tx.usuario.count({ where: { email: denied.email } }),
            0,
          );
          checks.push('Alta rechazada sin cuenta huérfana');
          await usuarios.cambiarEstado(u2, 0, actor.id);
          assert.equal(await count(), 1);
          checks.push('Suspender cuenta libera plaza');
          const u3 = await alta(tenant);
          await blocked(
            () => usuarios.cambiarEstado(u2, 1, actor.id),
            'Reactivación global SaaS bloqueada al llenar cupo',
          );
          assert.equal(
            (await tx.usuario.findUniqueOrThrow({ where: { id: u2 } })).estado,
            0,
          );
          checks.push('Reactivación rechazada conserva cuenta suspendida');
          await gestion.cambiarEstado(org, u3, 0, tenant);
          assert.equal(await count(), 1);
          await usuarios.cambiarEstado(u2, 1, actor.id);
          assert.equal(await count(), 2);
          checks.push(
            'Desactivar membresía libera plaza y permite reactivación global',
          );
          await blocked(
            () => gestion.cambiarEstado(org, u3, 1, tenant),
            'Reactivar membresía bloqueado al llenar cupo',
          );
          await blocked(
            () =>
              gestion.crearCuentaPlataforma(
                {
                  ...input(),
                  asignacion: { organizacionId: org, rol: 'USUARIO' },
                },
                actor.id,
              ),
            'Alta SaaS con empresa bloqueada al llenar cupo',
          );
          const libre = await gestion.crearCuentaPlataforma(input(), actor.id);
          created.push(libre.id);
          await blocked(
            () => gestion.asignar(org, libre.id, 'USUARIO', ctx),
            'Vincular cuenta existente bloqueado al llenar cupo',
          );
          await gestion.cambiarEstado(org, u2, 0, tenant);
          await gestion.asignar(org, libre.id, 'USUARIO', ctx);
          assert.equal(await count(), 2);
          checks.push('Vincular cuenta existente permitido con plaza libre');
          await gestion.asignar(org, libre.id, 'ADMINISTRADOR', ctx);
          await usuarios.cambiarEstado(libre.id, 1, actor.id);
          assert.equal(await count(), 2);
          checks.push('Editar rol y repetir activación no consumen otra plaza');
          const listado = await gestion.listar(org, ctx);
          const empresa = await empresas.obtenerPorId(org);
          assert.equal(listado.activos, 2);
          assert.equal(empresa.usuariosActivos, 2);
          assert.equal(listado.limite, 2);
          checks.push('Conteo consistente en empresa y administración SaaS');
          await limit(1);
          assert.equal(await count(), 2);
          await blocked(
            () => alta(tenant),
            'Bajar límite conserva usuarios y bloquea nuevas altas',
          );
          const platform = await gestion.crearCuentaPlataforma(
            {
              ...input(),
              esAdminPlataforma: true,
              asignacion: { organizacionId: org, rol: 'USUARIO' },
            },
            actor.id,
          );
          created.push(platform.id);
          assert.equal(await count(), 2);
          checks.push('Administrador SaaS no consume cupo de cliente');
          await limit(null);
          await alta(tenant);
          assert.equal(await count(), 3);
          checks.push('Quitar límite vuelve a permitir altas');

          // Otro proceso no debe poder entrar mientras esta transacción retiene
          // el bloqueo de empresa, incluso si las escrituras siguen sin confirmar.
          const competing = service({
            $transaction: (fn) =>
              db.$transaction(
                async (other) => {
                  await other.$executeRawUnsafe(
                    "SET LOCAL lock_timeout = '500ms'",
                  );
                  return fn(other);
                },
                { timeout: 5000 },
              ),
          });
          await assert.rejects(
            () => competing.crear(org, input(), ctx),
            (e) => /lock timeout/i.test(e.message),
          );
          checks.push('Una alta concurrente espera el bloqueo de cupo');
          throw rollback;
        },
        { timeout: 45000 },
      );
      assert.fail('La transacción de prueba no se revirtió');
    } catch (e) {
      if (e !== rollback) throw e;
    }
    assert.deepEqual(await snapshot(), before);
    assert.equal(await db.usuario.count({ where: { id: { in: created } } }), 0);
    checks.push(
      'Restauración completa: empresa, membresías, eventos y cuentas de prueba',
    );
    for (const check of checks) console.log(`OK: ${check}`);
    console.log(
      `RESULTADO: ${checks.length} comprobaciones correctas; todos los cambios revertidos.`,
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
