// Proceso separado: comparte únicamente PostgreSQL con el test.
const {
  PrismaService,
} = require('../src/shared/infrastructure/prisma.service');
const {
  ControlAtencionService,
} = require('../src/whatsapp/messaging/application/control-atencion.service');
const {
  BotEmpresaService,
} = require('../src/whatsapp/messaging/application/bot-empresa.service');
const db = new PrismaService();
const { ConfigService } = require('@nestjs/config');
const bot = new BotEmpresaService(
  db,
  { estado: async () => ({ operativa: true }) },
  new ConfigService({ AUTOMATIZACIONES_CLIENTES_HABILITADAS: true }),
); // Proveedor simulado exclusivo del test.
const control = new ControlAtencionService(
  db,
  { emitirAOrganizacion() {} },
  bot,
);
process.once('message', async (input) => {
  try {
    let result;
    if (input.action === 'take') {
      result = await control.tomar(
        input.org,
        input.chat,
        { usuarioId: input.user, rol: 'USUARIO' },
        input.version,
      );
    } else {
      result = await control.despachar(
        input.org,
        input.chat,
        {
          tipo: 'BOT',
          configVersion: 0,
          controlVersion: 0,
          entradaRevision: 0,
          clave: input.key,
        },
        'enviarMediaWhatsApp',
        async () => {
          process.send({ event: 'started' });
          await new Promise((resolve) => process.once('message', resolve));
          return { wamid: input.key };
        },
      );
    }
    await db.$disconnect();
    process.send({ event: 'done', result }, () => process.exit(0));
  } catch (error) {
    await db.$disconnect();
    process.send({ event: 'error', message: error.message }, () =>
      process.exit(0),
    );
  }
});
