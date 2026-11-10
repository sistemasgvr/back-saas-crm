const fs = require('fs'), crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const M = '20261110000000_permiso_exportar_datos';
const sql = fs.readFileSync(`prisma/migrations/${M}/migration.sql`, 'utf8');
const checksum = crypto.createHash('sha256').update(fs.readFileSync(`prisma/migrations/${M}/migration.sql`)).digest('hex');
const p = new PrismaClient();
const resumen = () => p.$queryRawUnsafe(`select codigo, count(*)::int total, sum(('empresa.exportar' = ANY(permisos))::int)::int con_permiso from organizacion_roles where es_sistema=1 group by codigo order by codigo`);
(async () => {
  console.log('antes', await resumen());
  const ya = await p.$queryRawUnsafe(`select count(*)::int n from _prisma_migrations where migration_name=$1`, M);
  if (ya[0].n > 0) { console.log('ya registrada, no se aplica'); return; }
  if (process.argv[2] !== 'aplicar') return;
  const [actualizados] = await p.$transaction([
    p.$executeRawUnsafe(sql),
    p.$executeRawUnsafe(`INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count) VALUES ($1, $2, now(), $3, now(), 1)`, crypto.randomUUID(), checksum, M),
  ]);
  console.log('roles actualizados:', actualizados);
  console.log('despues', await resumen());
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => p.$disconnect());
