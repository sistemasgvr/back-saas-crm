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

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

if (!process.env.PORT) {
  console.error('[server.js] PORT no definido — Hostinger debe inyectarlo. No fijes PORT=4000 en hPanel.');
  process.exit(1);
}

console.error(`[server.js] Iniciando Nest desde ${entry} (PORT=${process.env.PORT})`);

try {
  require(path.join(__dirname, entry));
} catch (error) {
  console.error('[server.js] Error al cargar la aplicación:', error);
  process.exit(1);
}
