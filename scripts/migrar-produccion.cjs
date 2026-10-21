// Migración de base de datos de producción, en pasos separados.
// Lee DATABASE_URL de .env.production. Ejecutar desde back-saas-crm:
//   node scripts/migrar-produccion.cjs estado     -> solo lectura: migraciones pendientes y conteos
//   node scripts/migrar-produccion.cjs respaldo   -> pg_dump completo a ./respaldos/ (vía Docker)
//   node scripts/migrar-produccion.cjs aplicar --confirmar  -> prisma migrate deploy + conteos después
// Requiere el contenedor Docker local `crm-postgres-dev` (pg_dump/psql 17).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CONTENEDOR = 'crm-postgres-dev';
const TABLAS = ['usuarios', 'organizacion_usuarios', 'leads', 'whatsapp_conversaciones', 'whatsapp_mensajes', 'inmuebles', 'lead_estado_historial', 'notificaciones'];

function urlProduccion() {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.production'), 'utf8');
  const m = env.match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  if (!m) throw Error('No hay DATABASE_URL en .env.production');
  const url = new URL(m[1]);
  if (['127.0.0.1', 'localhost'].includes(url.hostname)) throw Error('DATABASE_URL de producción apunta a local');
  return url;
}

function psql(url, sql, soloLectura = true) {
  const sinSchema = new URL(url); sinSchema.searchParams.delete('schema');
  const r = spawnSync('docker', ['exec', '-e', `PGURL=${sinSchema}`, ...(soloLectura ? ['-e', 'PGOPTIONS=-c default_transaction_read_only=on'] : []), CONTENEDOR, 'sh', '-c', `psql "$PGURL" -Atc "${sql}"`], { encoding: 'utf8' });
  if (r.status !== 0) throw Error(r.stderr);
  return r.stdout.trim();
}

function conteos(url) {
  const sql = TABLAS.map((t) => `select '${t}', count(*) from ${t}`).join(' union all ');
  return Object.fromEntries(psql(url, sql).split('\n').map((l) => { const [t, n] = l.split('|'); return [t, Number(n)]; }));
}

function prisma(url, args) {
  return spawnSync(process.execPath, [path.join(__dirname, '..', 'node_modules/prisma/build/index.js'), ...args], {
    cwd: path.join(__dirname, '..'), env: { ...process.env, DATABASE_URL: url.toString() }, encoding: 'utf8',
  });
}

const paso = process.argv[2];
const url = urlProduccion();

if (paso === 'estado') {
  const r = prisma(url, ['migrate', 'status']);
  console.log((r.stdout + r.stderr).split('\n').filter((l) => /migration|pending|applied|not yet|up to date|Following/i.test(l)).join('\n'));
  console.log('Conteos actuales:', conteos(url));
} else if (paso === 'respaldo') {
  const nombre = `prod-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`;
  const sinSchema = new URL(url); sinSchema.searchParams.delete('schema');
  const r = spawnSync('docker', ['exec', '-e', `PGURL=${sinSchema}`, '-e', 'PGOPTIONS=-c default_transaction_read_only=on', CONTENEDOR, 'sh', '-c', `pg_dump "$PGURL" -Fc --no-owner --no-acl -f /tmp/${nombre}`], { encoding: 'utf8' });
  if (r.status !== 0) throw Error(r.stderr);
  const destino = path.join(__dirname, '..', 'respaldos');
  fs.mkdirSync(destino, { recursive: true });
  const cp = spawnSync('docker', ['cp', `${CONTENEDOR}:/tmp/${nombre}`, path.join(destino, nombre)], { encoding: 'utf8' });
  if (cp.status !== 0) throw Error(cp.stderr);
  const lista = spawnSync('docker', ['exec', CONTENEDOR, 'pg_restore', '-l', `/tmp/${nombre}`], { encoding: 'utf8' });
  if (lista.status !== 0) throw Error('El respaldo no se puede leer: ' + lista.stderr);
  console.log(`Respaldo verificado: respaldos/${nombre} (${fs.statSync(path.join(destino, nombre)).size} bytes)`);
} else if (paso === 'aplicar') {
  if (!process.argv.includes('--confirmar')) throw Error('Falta --confirmar');
  const antes = conteos(url);
  const inicio = Date.now();
  const r = prisma(url, ['migrate', 'deploy']);
  console.log(r.stdout + r.stderr);
  if (r.status !== 0) { console.error('La migración falló. Revisa el mensaje; los datos anteriores no se borran.'); process.exit(1); }
  const despues = conteos(url);
  const cambios = TABLAS.filter((t) => antes[t] !== despues[t]);
  console.log(`Duración: ${((Date.now() - inicio) / 1000).toFixed(1)} s`);
  console.log(cambios.length ? `Cambiaron conteos (puede ser tráfico en vivo): ${cambios.map((t) => `${t} ${antes[t]}->${despues[t]}`).join(', ')}` : 'Conteos idénticos antes y después.');
} else {
  console.log('Uso: node scripts/migrar-produccion.cjs estado | respaldo | aplicar --confirmar');
}
