/**
 * Entry point para Hostinger Node.js Web Apps.
 * hPanel → Entry file: server.js
 *
 * NO definas PORT en hPanel — Hostinger lo inyecta automáticamente.
 */
const fs = require('fs');
const path = require('path');

const candidates = ['dist/main.js', 'dist/src/main.js'];
const entry = candidates.find((candidate) =>
  fs.existsSync(path.join(__dirname, candidate)),
);

if (!entry) {
  console.error('[server.js] No se encontró main.js compilado.');
  console.error('[server.js] Ejecuta npm run build. Buscado:', candidates.join(', '));
  try {
    const distPath = path.join(__dirname, 'dist');
    console.error('[server.js] Contenido de dist/:', fs.readdirSync(distPath));
  } catch {
    console.error('[server.js] La carpeta dist/ no existe.');
  }
  process.exit(1);
}

console.error(`[server.js] Iniciando Nest desde ${entry} (PORT=${process.env.PORT ?? 'no definido'})`);

try {
  require(path.join(__dirname, entry));
} catch (error) {
  console.error('[server.js] Error al cargar la aplicación:', error);
  process.exit(1);
}
