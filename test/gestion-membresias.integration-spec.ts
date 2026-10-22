import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { GestionMembresiasService } from '../src/organizations/application/gestion-membresias.service';
import { ControlAtencionService } from '../src/whatsapp/messaging/application/control-atencion.service';
import { PrismaService } from '../src/shared/infrastructure/prisma.service';
import type { RequestContext } from '../src/auth/domain/request-context.interface';

const connection = process.env.WHATSAPP_CONTROL_TEST_DATABASE_URL;
if (connection) {
  const u = new URL(connection);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) ||
    !u.pathname.endsWith('_test')
  )
    throw Error('Solo base local de test');
}
(connection ? describe : describe.skip)(
  'Gestión de membresías con PostgreSQL real',
  () => {
    const schema = `usuarios_test_${randomUUID().replaceAll('-', '')}`;
    const org = randomUUID(),
      otra = randomUUID(),
      owner = randomUUID(),
      admin = randomUUID(),
      asesor = randomUUID(),
      platform = randomUUID();
    let db: PrismaClient, service: GestionMembresiasService;
    const ctx = (id = owner, plataforma = false): RequestContext => ({
      usuarioId: id,
      organizacionId: org,
      esAdminPlataforma: plataforma,
    });
    const nuevo = (rol: 'USUARIO' | 'PROPIETARIO' = 'USUARIO') => ({
      email: `${randomUUID()}@example.test`,
      nombre: 'Prueba',
      password: 'SoloPruebas2026!',
      rol,
    });
    beforeAll(async () => {
      const url = new URL(connection!);
      url.searchParams.set('schema', schema);
      const deploy = spawnSync(
        process.execPath,
        ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
        {
          env: { ...process.env, DATABASE_URL: url.toString() },
          encoding: 'utf8',
          timeout: 60000,
        },
      );
      if (deploy.status !== 0)
        throw Error('Falló migración en esquema de usuarios aislado');
      db = new PrismaClient({ datasourceUrl: url.toString() });
      await db.organizacion.createMany({
        data: [
          { id: org, nombre: 'Empresa A', slug: org },
          { id: otra, nombre: 'Empresa B', slug: otra },
        ],
      });
      for (const [id, rol] of [
        [owner, 'PROPIETARIO'],
        [admin, 'ADMINISTRADOR'],
        [asesor, 'USUARIO'],
        [platform, 'PLATAFORMA'],
      ]) {
        await db.usuario.create({
          data: {
            id,
            email: `${id}@example.test`,
            nombre: 'Prueba',
            passwordHash: 'hash-sintetico',
            esAdminPlataforma: id === platform ? 1 : 0,
          },
        });
        if (id !== platform)
          await db.organizacionUsuario.create({
            data: { organizacionId: org, usuarioId: id, rol },
          });
      }
      const control = new ControlAtencionService(
        db as PrismaService,
        { emitirAOrganizacion: jest.fn() } as never,
        {} as never,
      );
      service = new GestionMembresiasService(
        db as PrismaService,
        {
          hash: () => Promise.resolve('hash-sintetico'),
          verify: () => Promise.resolve(true),
        } as never,
        control,
        { execute: jest.fn().mockResolvedValue(undefined) } as never,
      );
    });
    afterAll(async () => {
      if (db) {
        await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
        await db.$disconnect();
      }
    });
    afterEach(async () => {
      await db.organizacion.update({
        where: { id: org },
        data: { limiteUsuarios: null },
      });
    });

    it('propietario y administrador crean usuarios y la contraseña es temporal', async () => {
      for (const actor of [owner, admin]) {
        const u = await service.crear(org, nuevo(), ctx(actor));
        expect(
          (await db.usuario.findUniqueOrThrow({ where: { id: u.id } }))
            .debeCambiarPassword,
        ).toBe(1);
      }
    });
    it('un usuario normal no gestiona aunque presente un rol antiguo', async () => {
      await expect(
        service.crear(org, nuevo(), { ...ctx(asesor), rol: 'PROPIETARIO' }),
      ).rejects.toThrow('No tienes permiso');
    });
    it('la marca de plataforma no puede falsificarse', async () => {
      await expect(
        service.crear(org, nuevo(), ctx(asesor, true)),
      ).rejects.toThrow('No tienes permiso');
    });
    it('ninguna empresa crea ni modifica propietarios', async () => {
      for (const actor of [owner, admin]) {
        await expect(
          service.crear(org, nuevo('PROPIETARIO'), ctx(actor)),
        ).rejects.toThrow('plataforma');
        await expect(
          service.editar(org, owner, { nombre: 'Cambio' }, ctx(actor)),
        ).rejects.toThrow('plataforma');
        await expect(
          service.passwordTemporal(org, owner, 'Temporal2026!', ctx(actor)),
        ).rejects.toThrow('plataforma');
      }
    });
    it('no permite desactivarse ni cambiar el propio rol', async () => {
      await expect(
        service.cambiarEstado(org, admin, 0, ctx(admin)),
      ).rejects.toThrow('No puedes');
      await expect(
        service.editar(org, admin, { rol: 'USUARIO' }, ctx(admin)),
      ).rejects.toThrow('No puedes');
    });
    it('ni plataforma elimina al último propietario activo', async () => {
      await expect(
        service.cambiarEstado(org, owner, 0, ctx(platform, true)),
      ).rejects.toThrow('al menos un propietario');
      await expect(
        service.asignar(org, owner, 'USUARIO', ctx(platform, true)),
      ).rejects.toThrow('al menos un propietario');
    });
    it('dos altas concurrentes con una plaza solo crean una cuenta', async () => {
      const activos = await db.organizacionUsuario.count({
        where: { organizacionId: org, estado: 1 },
      });
      await db.organizacion.update({
        where: { id: org },
        data: { limiteUsuarios: activos + 1 },
      });
      const inputs = [nuevo(), nuevo()];
      const respuestas = await Promise.allSettled(
        inputs.map((input) => service.crear(org, input, ctx())),
      );
      expect(respuestas.filter((r) => r.status === 'fulfilled')).toHaveLength(
        1,
      );
      expect(
        await db.organizacionUsuario.count({
          where: { organizacionId: org, estado: 1 },
        }),
      ).toBe(activos + 1);
      expect(
        await db.usuario.count({
          where: { email: { in: inputs.map((i) => i.email) } },
        }),
      ).toBe(1);
    });
    it('cuenta propietarios; bajar el límite no desactiva a nadie y bloquea altas', async () => {
      const antes = await db.organizacionUsuario.count({
        where: { organizacionId: org, estado: 1 },
      });
      await db.organizacion.update({
        where: { id: org },
        data: { limiteUsuarios: 1 },
      });
      await expect(service.crear(org, nuevo(), ctx())).rejects.toThrow(
        'límite',
      );
      expect((await service.listar(org, ctx())).activos).toBe(antes);
    });
    it('reactivar consume cupo y no duplica membresías', async () => {
      const u = await service.crear(org, nuevo(), ctx());
      await service.cambiarEstado(org, u.id, 0, ctx());
      await db.organizacion.update({
        where: { id: org },
        data: { limiteUsuarios: 1 },
      });
      await expect(service.cambiarEstado(org, u.id, 1, ctx())).rejects.toThrow(
        'límite',
      );
      await db.organizacion.update({
        where: { id: org },
        data: { limiteUsuarios: null },
      });
      await service.cambiarEstado(org, u.id, 1, ctx());
      expect(
        await db.organizacionUsuario.count({
          where: { organizacionId: org, usuarioId: u.id },
        }),
      ).toBe(1);
    });
    it('plataforma respeta el cupo y no puede compartir una cuenta', async () => {
      await expect(
        service.asignar(otra, asesor, 'USUARIO', ctx(platform, true)),
      ).rejects.toThrow('email no está disponible');
      await db.organizacion.update({
        where: { id: otra },
        data: { limiteUsuarios: 1 },
      });
      const libre = await db.usuario.create({
        data: {
          email: `${randomUUID()}@example.test`,
          nombre: 'Sin empresa',
          passwordHash: 'hash',
        },
      });
      await service.asignar(otra, libre.id, 'USUARIO', ctx(platform, true));
      const otroCliente = await db.usuario.create({
        data: {
          email: `${randomUUID()}@example.test`,
          nombre: 'Otro cliente',
          passwordHash: 'hash',
        },
      });
      await expect(
        service.asignar(otra, otroCliente.id, 'USUARIO', ctx(platform, true)),
      ).rejects.toThrow('límite');
      // Una cuenta de plataforma con membresía no consume una plaza.
      await service.asignar(
        otra,
        platform,
        'ADMINISTRADOR',
        ctx(platform, true),
      );
      expect((await service.listar(otra, ctx(platform, true))).activos).toBe(1);
      // Una membresía activa con cuenta global suspendida tampoco cuenta.
      await db.usuario.update({ where: { id: libre.id }, data: { estado: 0 } });
      const listado = await service.listar(otra, ctx(platform, true));
      expect(listado.activos).toBe(0);
      expect(listado.data.find((u) => u.id === libre.id)?.cuentaActiva).toBe(
        false,
      );
      await service.asignar(
        otra,
        otroCliente.id,
        'USUARIO',
        ctx(platform, true),
      );
      expect((await service.listar(otra, ctx(platform, true))).activos).toBe(1);
    });
    it('aislamiento: no lista ni modifica otra empresa y no revela correos ajenos', async () => {
      await expect(service.listar(otra, ctx())).rejects.toThrow(
        'No tienes permiso',
      );
      await expect(
        service.editar(org, platform, { nombre: 'Cambio' }, ctx()),
      ).rejects.toThrow('no encontrado');
      await expect(
        service.crear(
          org,
          { ...nuevo(), email: `${platform}@example.test` },
          ctx(),
        ),
      ).rejects.toThrow('Este email no está disponible. Contacta a soporte.');
    });
    it('un usuario previo se reactiva por estado, nunca crea otra cuenta', async () => {
      const datos = nuevo(),
        u = await service.crear(org, datos, ctx());
      await service.cambiarEstado(org, u.id, 0, ctx());
      await expect(service.crear(org, datos, ctx())).rejects.toThrow(
        'Reactiva',
      );
    });
    it('desactivar retira la rotación y revoca tokens conservando al usuario y sus leads', async () => {
      const u = await service.crear(org, nuevo(), ctx());
      await db.leadAutoAsignacionConfig.upsert({
        where: { organizacionId: org },
        create: {
          organizacionId: org,
          usuarioPrimeroId: u.id,
          usuarioSegundoId: u.id,
          usuarioIds: [u.id],
          habilitado: 1,
        },
        update: {
          usuarioPrimeroId: u.id,
          usuarioSegundoId: u.id,
          usuarioIds: [u.id],
          habilitado: 1,
        },
      });
      await db.tokenRefresco.create({
        data: {
          usuarioId: u.id,
          tokenHash: 'synthetic',
          familiaId: randomUUID(),
          expiraEn: new Date(Date.now() + 60000),
        },
      });
      await service.cambiarEstado(org, u.id, 0, ctx());
      expect(
        (
          await db.leadAutoAsignacionConfig.findUniqueOrThrow({
            where: { organizacionId: org },
          })
        ).habilitado,
      ).toBe(0);
      expect(
        await db.tokenRefresco.count({ where: { usuarioId: u.id, estado: 1 } }),
      ).toBe(0);
      expect(
        (await db.usuario.findUniqueOrThrow({ where: { id: u.id } })).estado,
      ).toBe(1);
    });
    it('reset temporal no admite autorreset y registra auditoría sin contraseña', async () => {
      await expect(
        service.passwordTemporal(org, admin, 'Temporal2026!', ctx(admin)),
      ).rejects.toThrow('perfil');
      await service.passwordTemporal(org, asesor, 'Temporal2026!', ctx());
      const evento = await db.organizacionUsuarioEvento.findFirstOrThrow({
        where: { usuarioId: asesor, accion: 'PASSWORD_TEMPORAL' },
      });
      expect(evento.actorId).toBe(owner);
      await expect(
        db.organizacionUsuarioEvento.delete({ where: { id: evento.id } }),
      ).rejects.toThrow('inmutables');
    });

    it('libera chats activos y tomas pendientes con auditoría, conservando intentos en curso y leads', async () => {
      const u = await service.crear(org, nuevo(), ctx());
      const meta = await db.metaConexion.create({
        data: { organizacionId: org, webhookVerifyToken: randomUUID() },
      });
      const linea = await db.whatsappConexion.create({
        data: {
          organizacionId: org,
          metaConexionId: meta.id,
          wabaId: randomUUID(),
          phoneNumberId: randomUUID(),
        },
      });
      const lead = await db.lead.create({
        data: {
          organizacionId: org,
          idExterno: randomUUID(),
          datosCrudos: {},
          asignadoUsuarioId: u.id,
        },
      });
      for (const modoAtencion of ['HUMANO_ACTIVO', 'TOMANDO_CONTROL']) {
        const chat = await db.whatsappConversacion.create({
          data: {
            organizacionId: org,
            whatsappConexionId: linea.id,
            leadId: lead.id,
            waId: randomUUID(),
            modoAtencion,
            controlUsuarioId: u.id,
            controlVersion: 4,
          },
        });
        await db.whatsappSalidaIntento.create({
          data: {
            organizacionId: org,
            conversacionId: chat.id,
            actor: 'HUMAN',
            usuarioId: u.id,
            clave: randomUUID(),
            tipo: 'test',
            controlVersion: 4,
            estado: 'DESPACHANDO',
          },
        });
      }
      const resultado = await service.cambiarEstado(org, u.id, 0, ctx());
      expect(resultado.leadsAsignados).toBe(1);
      const chats = await db.whatsappConversacion.findMany({
        where: { leadId: lead.id },
      });
      expect(chats).toHaveLength(2);
      for (const c of chats) {
        expect(c.modoAtencion).toBe('MANUAL');
        expect(c.controlUsuarioId).toBeNull();
        expect(c.controlVersion).toBe(5);
        const e = await db.whatsappControlEvento.findFirstOrThrow({
          where: { conversacionId: c.id },
        });
        expect(e.motivo).toBe('membresia_desactivada');
        expect(e.usuarioId).toBe(owner);
      }
      expect(
        await db.whatsappSalidaIntento.count({
          where: {
            conversacionId: { in: chats.map((c) => c.id) },
            estado: 'DESPACHANDO',
          },
        }),
      ).toBe(2);
      expect(
        (await db.lead.findUniqueOrThrow({ where: { id: lead.id } }))
          .asignadoUsuarioId,
      ).toBe(u.id);
      await service.reasignarLeads(org, u.id, admin, ctx());
      const reasignado = await db.lead.findUniqueOrThrow({
        where: { id: lead.id },
      });
      expect(reasignado.asignadoUsuarioId).toBe(admin);
      expect(reasignado.asignadoPorUsuarioId).toBe(owner);
    });
    it('la reasignación masiva rechaza origen activo y destino de otra empresa', async () => {
      const u = await service.crear(org, nuevo(), ctx());
      await expect(
        service.reasignarLeads(org, u.id, admin, ctx()),
      ).rejects.toThrow('Desactiva primero');
      await service.cambiarEstado(org, u.id, 0, ctx());
      const lead = await db.lead.create({
        data: {
          organizacionId: org,
          idExterno: randomUUID(),
          datosCrudos: {},
          asignadoUsuarioId: u.id,
        },
      });
      await expect(
        service.reasignarLeads(org, u.id, platform, ctx()),
      ).rejects.toThrow('usuario activo de esta empresa');
      expect(
        (await db.lead.findUniqueOrThrow({ where: { id: lead.id } }))
          .asignadoUsuarioId,
      ).toBe(u.id);
      expect(
        (await service.reasignarLeads(org, u.id, admin, ctx())).reasignados,
      ).toBe(1);
      expect(
        (await service.reasignarLeads(org, u.id, admin, ctx())).reasignados,
      ).toBe(0);
    });
    it('saca al desactivado de una rotación con otros asesores sin apagarla', async () => {
      const u = await service.crear(org, nuevo(), ctx());
      await db.leadAutoAsignacionConfig.update({
        where: { organizacionId: org },
        data: {
          habilitado: 1,
          usuarioIds: [u.id, admin],
          usuarioPrimeroId: u.id,
          usuarioSegundoId: admin,
        },
      });
      await service.cambiarEstado(org, u.id, 0, ctx());
      const cfg = await db.leadAutoAsignacionConfig.findUniqueOrThrow({
        where: { organizacionId: org },
      });
      expect(cfg.usuarioIds).toEqual([admin]);
      expect(cfg.habilitado).toBe(1);
      expect(cfg.usuarioPrimeroId).toBe(admin);
    });
    it('conserva tokens históricos si aún hay otra membresía activa', async () => {
      // Datos heredados: no se crean por los nuevos endpoints ni se migran solos.
      const u = await service.crear(org, nuevo(), ctx());
      await db.organizacionUsuario.create({
        data: { organizacionId: otra, usuarioId: u.id, rol: 'USUARIO' },
      });
      await db.tokenRefresco.create({
        data: {
          usuarioId: u.id,
          tokenHash: 'synthetic-legacy',
          familiaId: randomUUID(),
          expiraEn: new Date(Date.now() + 60000),
        },
      });
      await service.cambiarEstado(org, u.id, 0, ctx());
      expect(
        await db.tokenRefresco.count({ where: { usuarioId: u.id, estado: 1 } }),
      ).toBe(1);
    });
  },
);
