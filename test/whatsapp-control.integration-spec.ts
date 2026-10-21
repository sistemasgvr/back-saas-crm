import { BotEmpresaService } from '../src/whatsapp/messaging/application/bot-empresa.service';
import { ConfigService } from '@nestjs/config';
import { AutomatizacionesIntegracionService as ConexionN8n } from '../src/shared/infrastructure/automatizaciones-integracion.service';
import { TokenEncryptionService } from '../src/shared/infrastructure/token-encryption.service';
import type { AutomatizacionesIntegracionService } from '../src/shared/infrastructure/automatizaciones-integracion.service';
import { fork, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { hash } from 'bcrypt';
import request from 'supertest';
import { OBJECT_STORAGE } from '../src/shared/application/ports/object-storage.port';
import { ControlAtencionService } from '../src/whatsapp/messaging/application/control-atencion.service';
import { PrismaService } from '../src/shared/infrastructure/prisma.service';

type WorkerMessage = {
  event: string;
  result?: { modoAtencion: string };
  message?: string;
};

const connection = process.env.WHATSAPP_CONTROL_TEST_DATABASE_URL;
// Nunca usar DATABASE_URL del proyecto: solo una base local explícita de test.
function testUrl(value: string) {
  const url = new URL(value);
  if (
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !url.pathname.endsWith('_test')
  )
    throw new Error(
      'Usa una base PostgreSQL local cuyo nombre termine en _test',
    );
  return url;
}
if (connection) testUrl(connection);

(connection ? describe : describe.skip)(
  'Control WhatsApp con PostgreSQL y procesos independientes',
  () => {
    const schema = `wa_control_test_${randomUUID().replaceAll('-', '')}`;
    const url = testUrl(
      connection ?? 'postgresql://localhost/whatsapp_control_test',
    );
    url.searchParams.set('schema', schema);
    const org = randomUUID(),
      user = randomUUID(),
      other = randomUUID(),
      line = randomUUID(),
      legacy = randomUUID();
    let db: PrismaClient;
    let control: ControlAtencionService;
    let work: string;
    let mensajesAntes: { contenido: string }[];
    const children = new Set<ReturnType<typeof fork>>();
    const migration = '20261007120000_whatsapp_control_humano';

    function deploy() {
      const out = spawnSync(
        process.execPath,
        [
          resolve('node_modules/prisma/build/index.js'),
          'migrate',
          'deploy',
          '--schema',
          join(work, 'schema.prisma'),
        ],
        {
          env: { ...process.env, DATABASE_URL: url.toString() },
          encoding: 'utf8',
          timeout: 60000,
        },
      );
      // Evitar imprimir URL/credenciales de conexión en caso de fallo.
      if (out.status !== 0)
        throw new Error(
          'No se pudo aplicar migraciones en el esquema aislado de test',
        );
    }

    function worker(input: object) {
      const child = fork(resolve('test/whatsapp-control.worker.cjs'), [], {
        execArgv: ['-r', 'ts-node/register/transpile-only'],
        env: { ...process.env, DATABASE_URL: url.toString() },
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      });
      children.add(child);
      let started!: () => void;
      const inicio = new Promise<void>((r) => {
        started = r;
      });
      const result = new Promise<WorkerMessage>((resolveResult, reject) => {
        const timer = setTimeout(() => {
          child.kill();
          reject(new Error('Worker de prueba no respondió'));
        }, 25000);
        child.on('message', (value: unknown) => {
          const m = value as WorkerMessage;
          if (m.event === 'started') started();
          if (m.event === 'done' || m.event === 'error') {
            clearTimeout(timer);
            resolveResult(m);
          }
        });
        child.on('error', (e) => {
          clearTimeout(timer);
          reject(e);
        });
      });
      child.send(input);
      return { inicio, result, release: () => child.send({ release: true }) };
    }

    beforeAll(async () => {
      mkdirSync(resolve('.tmp'), { recursive: true });
      work = mkdtempSync(resolve('.tmp/control-'));
      cpSync(resolve('prisma/schema.prisma'), join(work, 'schema.prisma'));
      mkdirSync(join(work, 'migrations'));
      for (const item of readdirSync(resolve('prisma/migrations'))) {
        if (item < migration || item === '20261021200000_gestion_usuarios_empresa' || item === 'migration_lock.toml')
          cpSync(
            resolve('prisma/migrations', item),
            join(work, 'migrations', item),
            { recursive: true },
          );
      }
      db = new PrismaClient({ datasourceUrl: url.toString() });
      deploy();
      await db.organizacion.create({
        data: { id: org, nombre: 'Test', slug: org },
      });
      const modulo = await db.modulo.upsert({
        where: { codigo: 'WHATSAPP' },
        create: { codigo: 'WHATSAPP', nombre: 'WhatsApp' },
        update: {},
      });
      await db.organizacionModulo.create({
        data: { organizacionId: org, moduloId: modulo.id, habilitado: 1 },
      });
      const auto = await db.modulo.create({
        data: { codigo: 'AUTOMATIZACIONES', nombre: 'Automatizaciones' },
      });
      await db.organizacionModulo.create({
        data: { organizacionId: org, moduloId: auto.id, habilitado: 1 },
      });
      for (const id of [user, other]) {
        await db.usuario.create({
          data: {
            id,
            nombre: 'Asesor',
            email: `${id}@example.invalid`,
            passwordHash: 'no-login',
          },
        });
        await db.organizacionUsuario.create({
          data: { organizacionId: org, usuarioId: id, rol: 'USUARIO' },
        });
      }
      const meta = await db.metaConexion.create({
        data: { organizacionId: org, webhookVerifyToken: randomUUID() },
      });
      await db.whatsappConexion.create({
        data: {
          id: line,
          organizacionId: org,
          metaConexionId: meta.id,
          wabaId: randomUUID(),
          phoneNumberId: randomUUID(),
        },
      });
      // Sembrar un chat anterior a fase 1 antes de ejecutar su backfill.
      await db.$executeRaw`INSERT INTO whatsapp_conversaciones (id, organizacion_id, whatsapp_conexion_id, wa_id, fecha_modificacion) VALUES (${legacy}::uuid, ${org}::uuid, ${line}::uuid, '51900000000', NOW())`;
      // Más de 500 filas clasificables: ejercita varias vueltas del backfill.
      // SQL explícito porque el cliente actual ya requiere columnas aún no migradas.
      await db.$executeRaw`
        INSERT INTO whatsapp_mensajes
          (id, organizacion_id, whatsapp_conversacion_id, wamid, direccion,
           tipo, texto, datos_crudos, fecha_mensaje, usuario_creacion)
        SELECT md5(${legacy} || serie::text)::uuid, ${org}::uuid, ${legacy}::uuid,
          'legacy-' || serie, CASE WHEN serie % 4 = 0 THEN 'entrante' ELSE 'saliente' END,
          'text', 'Mensaje previo ' || serie,
          CASE WHEN serie % 4 = 2 THEN '{"origen":"agenda_recordatorio"}'::jsonb ELSE '{}'::jsonb END,
          '2026-10-01T12:00:00Z'::timestamptz,
          CASE WHEN serie % 4 = 1 THEN ${user}::uuid ELSE NULL END
        FROM generate_series(1, 1004) AS serie`;
      mensajesAntes = await db.$queryRaw<{ contenido: string }[]>`
        SELECT (to_jsonb(m) - 'autor_tipo')::text AS contenido
        FROM whatsapp_mensajes m ORDER BY id`;
      cpSync(
        resolve('prisma/migrations', migration),
        join(work, 'migrations', migration),
        { recursive: true },
      );
      deploy();
      cpSync(
        resolve('prisma/migrations/20261009120000_whatsapp_bot_admin'),
        join(work, 'migrations/20261009120000_whatsapp_bot_admin'),
        { recursive: true },
      );
      deploy();
      cpSync(
        resolve('prisma/migrations/20261009233000_bot_preferencias_empresa'),
        join(work, 'migrations/20261009233000_bot_preferencias_empresa'),
        { recursive: true },
      );
      deploy();
      cpSync(
        resolve(
          'prisma/migrations/20261010000000_n8n_configuracion_plataforma',
        ),
        join(work, 'migrations/20261010000000_n8n_configuracion_plataforma'),
        { recursive: true },
      );
      deploy();
      // Toda migración posterior también debe pasar sobre los datos previos.
      for (const item of readdirSync(resolve('prisma/migrations'))) {
        if (item > '20261010000000_n8n_configuracion_plataforma')
          cpSync(
            resolve('prisma/migrations', item),
            join(work, 'migrations', item),
            { recursive: true },
          );
      }
      deploy();
      const bot = new BotEmpresaService(
        db as PrismaService,
        {
          estado: () =>
            Promise.resolve({
              proveedor: 'n8n',
              alcance: 'PLATAFORMA',
              configurada: true,
              operativa: true,
              estado: 'TEST',
            }),
        } as AutomatizacionesIntegracionService,
        new ConfigService({ AUTOMATIZACIONES_CLIENTES_HABILITADAS: true }),
      );
      jest.spyOn(bot, 'integracion').mockResolvedValue({
        proveedor: 'n8n',
        alcance: 'PLATAFORMA',
        configurada: true,
        operativa: true,
        estado: 'TEST',
      });
      control = new ControlAtencionService(
        db as PrismaService,
        {
          emitirAOrganizacion() {},
          emitirAUsuarios() {},
        },
        bot,
      );
      await db.whatsappBotConfiguracion.create({
        data: { organizacionId: org, habilitado: true },
      });
    });

    it('persistencia n8n cifra secretos y mantiene la auditoría inmutable', async () => {
      const admin = await db.usuario.create({
        data: {
          email: `${randomUUID()}@example.invalid`,
          nombre: 'Admin n8n test',
          passwordHash: 'no-login',
          esAdminPlataforma: 1,
        },
      });
      const crypto = new TokenEncryptionService(
        new ConfigService({
          META_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 4).toString('base64'),
        }),
      );
      const conexion = new ConexionN8n(db as PrismaService, crypto);
      const input = {
        webhookUrl: 'https://n8n.example.invalid/webhook/test',
        headerNombre: 'X-CRM-Secret',
        secreto: 'clave-sintetica-de-integracion',
        version: 0,
      };
      const result = await conexion.guardar(admin.id, input);
      expect(result).toMatchObject({
        version: 1,
        credencialConfigurada: true,
        operativa: false,
      });
      expect(result).not.toHaveProperty('secretoCifrado');
      const stored = await db.automatizacionIntegracion.findUniqueOrThrow({
        where: { id: 'n8n' },
      });
      expect(stored.secretoCifrado).not.toBe(input.secreto);
      expect(crypto.decrypt(stored.secretoCifrado!)).toBe(input.secreto);
      await expect(conexion.guardar(admin.id, input)).rejects.toThrow(
        'La conexión cambió',
      );
      const event = await db.automatizacionIntegracionEvento.findUniqueOrThrow({
        where: { version: 1 },
      });
      await expect(
        db.automatizacionIntegracionEvento.delete({ where: { id: event.id } }),
      ).rejects.toThrow();
    });

    it('tomar chat humano compara la asignación y actualiza lead, atención y auditoría juntos', async () => {
      const admin = await db.usuario.create({
        data: {
          email: `${randomUUID()}@example.invalid`,
          nombre: 'Admin de empresa test',
          passwordHash: 'no-login',
        },
      });
      await db.organizacionUsuario.create({
        data: {
          organizacionId: org,
          usuarioId: admin.id,
          rol: 'ADMINISTRADOR',
        },
      });
      const lead = await db.lead.create({
        data: {
          organizacionId: org,
          idExterno: randomUUID(),
          datosCrudos: {},
          asignadoUsuarioId: other,
        },
      });
      const c = await db.whatsappConversacion.create({
        data: {
          organizacionId: org,
          whatsappConexionId: line,
          waId: randomUUID(),
          leadId: lead.id,
        },
      });
      await db.lead.update({
        where: { id: lead.id },
        data: { asignadoUsuarioId: user },
      });
      await expect(
        control.asumirHumano(
          org,
          c.id,
          { usuarioId: admin.id, rol: 'ADMINISTRADOR' },
          0,
          other,
        ),
      ).rejects.toThrow('La atención o asignación cambió');
      expect(
        await db.whatsappConversacion.findUnique({ where: { id: c.id } }),
      ).toMatchObject({ modoAtencion: 'MANUAL', controlVersion: 0 });
      await control.asumirHumano(
        org,
        c.id,
        { usuarioId: admin.id, rol: 'ADMINISTRADOR' },
        0,
        user,
      );
      expect(
        await db.lead.findUnique({ where: { id: lead.id } }),
      ).toMatchObject({ asignadoUsuarioId: admin.id });
      expect(
        await db.whatsappConversacion.findUnique({ where: { id: c.id } }),
      ).toMatchObject({
        modoAtencion: 'HUMANO_ACTIVO',
        controlUsuarioId: admin.id,
        controlVersion: 1,
      });
      expect(
        await db.whatsappControlEvento.count({
          where: { conversacionId: c.id, motivo: 'toma_chat_humano' },
        }),
      ).toBe(1);
    });

    afterAll(async () => {
      children.forEach((child) => child.kill());
      if (db) {
        if (!/^wa_control_test_[a-f0-9]+$/.test(schema))
          throw new Error('Esquema de limpieza no válido');
        await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await db.$disconnect();
      }
      if (work && resolve(work).startsWith(resolve('.tmp') + '\\'))
        rmSync(work, { recursive: true });
    });

    async function chat() {
      return db.whatsappConversacion.create({
        data: {
          organizacionId: org,
          whatsappConexionId: line,
          waId: randomUUID(),
          modoAtencion: 'BOT_ACTIVO',
          ventanaExpiraEn: new Date(Date.now() + 60000),
        },
      });
    }

    it('backfill mantiene chats antiguos manuales, sin emitir eventos', async () => {
      expect(
        await db.whatsappConversacion.findUnique({ where: { id: legacy } }),
      ).toMatchObject({
        modoAtencion: 'MANUAL',
        controlVersion: 0,
        entradaRevision: 0,
      });
      expect(
        await db.whatsappControlEvento.count({
          where: { conversacionId: legacy },
        }),
      ).toBe(0);
    });

    it('PostgreSQL acepta salidas RECHAZADO y sigue rechazando estados desconocidos', async () => {
      const data = {
        organizacionId: org,
        conversacionId: legacy,
        actor: 'SYSTEM',
        clave: randomUUID(),
        tipo: 'prueba_salida_rechazada',
        controlVersion: 0,
        estado: 'RECHAZADO',
      };
      expect(await db.whatsappSalidaIntento.create({ data })).toMatchObject({
        estado: 'RECHAZADO',
      });
      await expect(
        db.whatsappSalidaIntento.create({
          data: { ...data, clave: randomUUID(), estado: 'ESTADO_INVALIDO' },
        }),
      ).rejects.toThrow();
    });

    it('migraciones conservan 1004 mensajes previos y clasifican su autoría en lotes', async () => {
      const mensajesDespues = await db.$queryRaw<{ contenido: string }[]>`
        SELECT (to_jsonb(m) - 'autor_tipo')::text AS contenido
        FROM whatsapp_mensajes m ORDER BY id`;
      expect(mensajesDespues).toEqual(mensajesAntes);
      expect(mensajesDespues).toHaveLength(1004);
      const autores = await db.whatsappMensaje.groupBy({
        by: ['autorTipo'],
        where: { whatsappConversacionId: legacy },
        _count: { _all: true },
      });
      expect(
        Object.fromEntries(autores.map((a) => [a.autorTipo, a._count._all])),
      ).toEqual({ CUSTOMER: 251, HUMAN: 251, SYSTEM: 251, UNKNOWN: 251 });
    });

    it('toma entre procesos bloquea siguiente archivo mientras espera el envío en curso', async () => {
      const c = await chat();
      const sender = worker({
        action: 'send',
        org,
        chat: c.id,
        key: randomUUID(),
      });
      await sender.inicio;
      const taker = worker({
        action: 'take',
        org,
        chat: c.id,
        user,
        version: 0,
      });
      const toma = await taker.result;
      if (toma.event === 'error')
        throw new Error(toma.message ?? 'Toma falló en proceso de test');
      expect(toma.result?.modoAtencion).toBe('TOMANDO_CONTROL');
      const enviar = jest.fn();
      await expect(
        control.despachar(
          org,
          c.id,
          {
            tipo: 'BOT',
            configVersion: 0,
            controlVersion: 0,
            entradaRevision: 0,
            clave: randomUUID(),
          },
          'enviarMediaWhatsApp',
          enviar,
        ),
      ).rejects.toThrow();
      expect(enviar).not.toHaveBeenCalled();
      sender.release();
      expect((await sender.result).event).toBe('done');
      expect((await control.estado(org, c.id)).modoAtencion).toBe(
        'HUMANO_ACTIVO',
      );
    });

    it('dos procesos no pueden ganar la misma versión de control', async () => {
      const c = await chat();
      const a = worker({ action: 'take', org, chat: c.id, user, version: 0 });
      const b = worker({
        action: 'take',
        org,
        chat: c.id,
        user: other,
        version: 0,
      });
      const results = await Promise.all([a.result, b.result]);
      expect(results.filter((r) => r.event === 'done')).toHaveLength(1);
      expect(
        await db.whatsappControlEvento.count({
          where: { conversacionId: c.id },
        }),
      ).toBe(2);
    });

    it('BD rechaza modificaciones de historial y responsable de otro tenant', async () => {
      const c = await chat();
      await control.tomar(org, c.id, { usuarioId: user, rol: 'USUARIO' }, 0);
      const evento = await db.whatsappControlEvento.findFirstOrThrow({
        where: { conversacionId: c.id },
      });
      await expect(
        db.whatsappControlEvento.update({
          where: { id: evento.id },
          data: { motivo: 'alteración' },
        }),
      ).rejects.toThrow();
      await expect(
        db.whatsappControlEvento.delete({ where: { id: evento.id } }),
      ).rejects.toThrow();
      await expect(
        db.whatsappConversacion.update({
          where: { id: c.id },
          data: { controlUsuarioId: randomUUID() },
        }),
      ).rejects.toThrow();
    });

    it('mismo contacto en otra línea conserva conversaciones separadas', async () => {
      const original = await db.whatsappConexion.findUniqueOrThrow({
        where: { id: line },
      });
      const second = await db.whatsappConexion.create({
        data: {
          organizacionId: org,
          metaConexionId: original.metaConexionId,
          wabaId: randomUUID(),
          phoneNumberId: randomUUID(),
        },
      });
      const c = await db.whatsappConversacion.create({
        data: {
          organizacionId: org,
          whatsappConexionId: second.id,
          waId: '51900000000',
        },
      });
      expect(c.id).not.toBe(legacy);
      expect(c.modoAtencion).toBe('MANUAL');
    });

    it('API migrada inicia, autentica y consulta perfil, leads y chats con PostgreSQL real', async () => {
      const password = randomUUID();
      const actor = await db.usuario.create({
        data: {
          email: `${randomUUID()}@example.invalid`,
          nombre: 'Smoke local',
          passwordHash: await hash(password, 4),
        },
      });
      await db.organizacionUsuario.create({
        data: {
          organizacionId: org,
          usuarioId: actor.id,
          rol: 'ADMINISTRADOR',
        },
      });
      const modulo = await db.modulo.create({
        data: { codigo: 'META_LEADS', nombre: 'Leads' },
      });
      await db.organizacionModulo.create({
        data: { organizacionId: org, moduloId: modulo.id, habilitado: 1 },
      });
      const env = {
        NODE_ENV: 'test',
        DATABASE_URL: url.toString(),
        LOG_LEVEL: 'silent',
        AGENDA_INLINE_CRON: '0',
        AUTOMATIZACIONES_CLIENTES_HABILITADAS: 'false',
        FRONTEND_URL: 'http://localhost:3000',
        JWT_ACCESS_SECRET: 'synthetic-access-secret-for-smoke',
        JWT_REFRESH_SECRET: 'synthetic-refresh-secret-for-smoke',
        META_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
        META_VERIFY_TOKEN: 'synthetic-verify',
        META_WEBHOOK_URL_TOKEN: 'synthetic-webhook',
        META_OAUTH_REDIRECT_URI: 'http://localhost:3000/callback',
        MINIO_SERVER_URL: 'http://localhost:9000',
        MINIO_ROOT_USER: 'synthetic',
        MINIO_ROOT_PASSWORD: 'synthetic',
      };
      const anterior = Object.fromEntries(
        Object.keys(env).map((k) => [k, process.env[k]]),
      );
      Object.assign(process.env, env);
      let app: import('@nestjs/common').INestApplication | undefined;
      try {
        const { AppModule } = await import('../src/app.module');
        const module = await Test.createTestingModule({ imports: [AppModule] })
          .overrideProvider(PrismaService)
          .useValue(db)
          .overrideProvider(OBJECT_STORAGE)
          .useValue({}) // No acceder al bucket compartido con producción.
          .compile();
        app = module.createNestApplication({ logger: false });
        app.useGlobalPipes(
          new ValidationPipe({ whitelist: true, transform: true }),
        );
        await app.init();
        const http = request(app.getHttpServer());
        await http.get('/health').expect(200);
        await http.get('/me').expect(401);
        await http
          .post('/auth/login')
          .send({ email: actor.email, password: 'incorrecta' })
          .expect(401);
        const login = await http
          .post('/auth/login')
          .send({ email: actor.email, password })
          .expect(201);
        const auth = `Bearer ${login.body.accessToken}`;
        const me = await http.get('/me').set('Authorization', auth).expect(200);
        expect(me.body.usuario.id).toBe(actor.id);
        expect(me.body.organizacion.id).toBe(org);
        const preferencias = await http
          .get('/whatsapp/bot/preferencias')
          .set('Authorization', auth)
          .expect(200);
        expect(preferencias.body).toMatchObject({
          clientesHabilitados: false,
          autorizado: false,
        });
        await http
          .patch('/whatsapp/bot/preferencias')
          .set('Authorization', auth)
          .send({
            modoInicial: 'BOT',
            preferenciasVersion: preferencias.body.preferenciasVersion,
          })
          .expect(403);
        await http.get('/leads').set('Authorization', auth).expect(200);
        await http
          .get('/whatsapp/chats')
          .set('Authorization', auth)
          .expect(200);
        await http
          .get(`/whatsapp/chats/${legacy}/control`)
          .set('Authorization', auth)
          .expect(200);
        expect(
          await db.tokenRefresco.count({ where: { usuarioId: actor.id } }),
        ).toBe(1);
        // Dos navegaciones simultáneas pueden renovar el mismo token sin
        // colisionar; cerrar la sesión invalida toda esa familia, incluso
        // cuando se recibe el token anterior dentro de la ventana de gracia.
        const rotations = await Promise.all(
          [0, 1].map(() =>
            http
              .post('/auth/refresh')
              .send({ refreshToken: login.body.refreshToken })
              .expect(201),
          ),
        );
        expect(rotations[0].body.refreshToken).not.toBe(
          rotations[1].body.refreshToken,
        );
        const otherSession = await http
          .post('/auth/login')
          .send({ email: actor.email, password })
          .expect(201);
        await http
          .post('/auth/logout')
          .send({ refreshToken: login.body.refreshToken })
          .expect(204);
        for (const refreshToken of [
          login.body.refreshToken,
          ...rotations.map((r) => r.body.refreshToken),
        ]) {
          await http.post('/auth/refresh').send({ refreshToken }).expect(401);
        }
        await http
          .post('/auth/refresh')
          .send({ refreshToken: otherSession.body.refreshToken })
          .expect(201);
        const legacyToken = new JwtService().sign(
          { sub: actor.id, organizacionId: org },
          { secret: env.JWT_REFRESH_SECRET, expiresIn: '1h' },
        );
        await db.tokenRefresco.create({
          data: {
            usuarioId: actor.id,
            tokenHash: createHash('sha256').update(legacyToken).digest('hex'),
            expiraEn: new Date(Date.now() + 3600000),
          },
        });
        const migrated = await http
          .post('/auth/refresh')
          .send({ refreshToken: legacyToken })
          .expect(201);
        await http
          .post('/auth/logout')
          .send({ refreshToken: legacyToken })
          .expect(204);
        await http
          .post('/auth/refresh')
          .send({ refreshToken: migrated.body.refreshToken })
          .expect(401);
        const racing = await http
          .post('/auth/login')
          .send({ email: actor.email, password })
          .expect(201);
        const [rotation, closed] = await Promise.all([
          http
            .post('/auth/refresh')
            .send({ refreshToken: racing.body.refreshToken }),
          http
            .post('/auth/logout')
            .send({ refreshToken: racing.body.refreshToken }),
        ]);
        expect(closed.status).toBe(204);
        expect([201, 401]).toContain(rotation.status);
        if (rotation.status === 201)
          await http
            .post('/auth/refresh')
            .send({ refreshToken: rotation.body.refreshToken })
            .expect(401);
      } finally {
        await app?.close();
        for (const [k, value] of Object.entries(anterior)) {
          if (value === undefined) delete process.env[k];
          else process.env[k] = value;
        }
      }
    });
  },
);
