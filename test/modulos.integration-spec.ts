import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { Test } from '@nestjs/testing';
import type { ExecutionContext } from '@nestjs/common';
import {
  GUARDS_METADATA,
  PARAMTYPES_METADATA,
  SELF_DECLARED_DEPS_METADATA,
} from '@nestjs/common/constants';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/shared/infrastructure/prisma.service';
import { PrismaOrganizacionModulosAdminRepository } from '../src/platform-admin/infrastructure/prisma-organizacion-modulos-admin.repository';
import { PrismaModulosCatalogoRepository } from '../src/modules/infrastructure/prisma-modulos-catalogo.repository';
import { PrismaModulosRepository } from '../src/auth/infrastructure/prisma-modulos.repository';
import { PrismaLeadsGestionRepository } from '../src/leads/infrastructure/prisma-leads-gestion.repository';
import { PrismaLeadsRepository } from '../src/meta/leads/infrastructure/prisma-leads.repository';
import { LeadsController } from '../src/leads/presentation/leads.controller';
import { MetaWebhooksController } from '../src/meta/webhooks/presentation/meta-webhooks.controller';
import { JwtAuthGuard } from '../src/auth/presentation/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../src/shared/presentation/guards/org-membership.guard';
import { RolesGuard } from '../src/shared/presentation/guards/roles.guard';
import { ModuleGuard } from '../src/shared/presentation/guards/module.guard';
import { REQUIRE_MODULE_KEY } from '../src/shared/presentation/decorators/require-module.decorator';

const connection = process.env.MODULES_TEST_DATABASE_URL;
if (connection) {
  const u = new URL(connection);
  if (
    !['localhost', '127.0.0.1'].includes(u.hostname) ||
    !/(_test|_validacion_20261021)$/.test(u.pathname)
  )
    throw Error('Solo base local explícita de validación');
}
(connection ? describe : describe.skip)(
  'Módulos con PostgreSQL real (rollback por prueba)',
  () => {
    let db: PrismaClient;
    beforeAll(() => {
      db = new PrismaClient({ datasourceUrl: connection });
    });
    afterAll(async () => {
      await db?.$disconnect();
    });
    async function fixture(
      fn: (f: {
        tx: Prisma.TransactionClient;
        client: PrismaService;
        repo: PrismaOrganizacionModulosAdminRepository;
        org: string;
        actor: string;
        ids: Record<string, string>;
        grupos: Record<string, string>;
      }) => Promise<void>,
    ) {
      const rollback = new Error('ROLLBACK_QA');
      try {
        await db.$transaction(
          async (tx) => {
            const org = (
              await tx.organizacion.create({
                data: { nombre: 'QA módulos', slug: randomUUID() },
              })
            ).id;
            const actor = randomUUID();
            const client = new Proxy(tx, {
              get(t, p) {
                if (p === '$transaction')
                  return (fn: (t: Prisma.TransactionClient) => unknown) =>
                    fn(tx);
                const v: unknown = Reflect.get(t, p);
                return typeof v === 'function'
                  ? ((v as (...args: unknown[]) => unknown).bind(tx) as unknown)
                  : v;
              },
            }) as unknown as PrismaService;
            const repo = new PrismaOrganizacionModulosAdminRepository(client);
            const ids = Object.fromEntries(
              (await tx.modulo.findMany()).map((m) => [m.codigo, m.id]),
            );
            const grupos = Object.fromEntries(
              (await tx.moduloGrupo.findMany()).map((m) => [m.codigo, m.id]),
            );
            await tx.whatsappBotConfiguracion.create({
              data: { organizacionId: org },
            });
            await fn({ tx, client, repo, org, actor, ids, grupos });
            throw rollback;
          },
          { timeout: 45000 },
        );
      } catch (e) {
        if (e !== rollback) throw e;
      }
    }
    it('activar automatizaciones activa WhatsApp y Leads e invalida el bot una sola vez', () =>
      fixture(async (f) => {
        await f.repo.toggle(f.org, f.ids.AUTOMATIZACIONES, true, f.actor);
        const activos = await f.tx.organizacionModulo.findMany({
          where: { organizacionId: f.org, habilitado: 1 },
          include: { modulo: true },
        });
        expect(activos.map((m) => m.modulo.codigo).sort()).toEqual([
          'AUTOMATIZACIONES',
          'LEADS',
          'WHATSAPP',
        ]);
        expect(
          (
            await f.tx.whatsappBotConfiguracion.findUniqueOrThrow({
              where: { organizacionId: f.org },
            })
          ).version,
        ).toBe(1);
        await f.repo.toggle(f.org, f.ids.AUTOMATIZACIONES, true, f.actor);
        expect(
          (
            await f.tx.whatsappBotConfiguracion.findUniqueOrThrow({
              where: { organizacionId: f.org },
            })
          ).version,
        ).toBe(1);
      }));
    it('rechaza 409 sin escrituras; permite desactivar dependientes juntos', () =>
      fixture(async (f) => {
        await f.repo.toggle(f.org, f.ids.AUTOMATIZACIONES, true, f.actor);
        await expect(
          f.repo.toggle(f.org, f.ids.LEADS, false, f.actor),
        ).rejects.toMatchObject({
          status: 409,
          response: {
            dependientes: expect.arrayContaining<string>([
              'WHATSAPP',
              'AUTOMATIZACIONES',
            ]) as unknown,
          },
        });
        expect(
          await f.tx.organizacionModulo.count({
            where: { organizacionId: f.org, habilitado: 1 },
          }),
        ).toBe(3);
        await f.repo.toggle(f.org, f.ids.LEADS, false, f.actor, true);
        expect(
          await f.tx.organizacionModulo.count({
            where: { organizacionId: f.org, habilitado: 1 },
          }),
        ).toBe(0);
      }));
    it('opera grupos completos y calcula ninguno, parcial y todos', () =>
      fixture(async (f) => {
        expect(
          (await f.repo.listarMatrizPorOrganizacion(f.org)).map(
            (g) => g.habilitado,
          ),
        ).toEqual(['ninguno', 'ninguno']);
        await f.repo.toggle(f.org, f.ids.DASHBOARD, true, f.actor);
        expect(
          (await f.repo.listarMatrizPorOrganizacion(f.org))[0].habilitado,
        ).toBe('parcial');
        await f.repo.toggleGrupo(f.org, f.grupos.CRM, true, f.actor);
        expect(
          (await f.repo.listarMatrizPorOrganizacion(f.org))[0].habilitado,
        ).toBe('todos');
        await f.repo.toggleGrupo(f.org, f.grupos.META, true, f.actor);
        await expect(
          f.repo.toggleGrupo(f.org, f.grupos.CRM, false, f.actor),
        ).rejects.toMatchObject({ status: 409 });
        await f.repo.toggleGrupo(f.org, f.grupos.CRM, false, f.actor, true);
        expect(
          (await f.repo.listarMatrizPorOrganizacion(f.org)).every(
            (g) => g.habilitado === 'ninguno',
          ),
        ).toBe(true);
      }));
    it('rechaza activar requisitos retirados sin habilitar parcialmente', () =>
      fixture(async (f) => {
        await f.tx.modulo.update({
          where: { id: f.ids.LEADS },
          data: { estado: 0 },
        });
        await expect(
          f.repo.toggle(f.org, f.ids.WHATSAPP, true, f.actor),
        ).rejects.toMatchObject({ status: 409 });
        expect(
          await f.tx.organizacionModulo.count({
            where: { organizacionId: f.org },
          }),
        ).toBe(0);
      }));
    it('valida códigos, grupo y ciclos del catálogo', () =>
      fixture(async (f) => {
        const catalogo = new PrismaModulosCatalogoRepository(f.client);
        await expect(
          catalogo.actualizar(
            f.ids.LEADS,
            { requiere: ['AUTOMATIZACIONES'] },
            f.actor,
          ),
        ).rejects.toMatchObject({ status: 400 });
        await expect(
          catalogo.actualizar(
            f.ids.LEADS,
            { requiere: ['INEXISTENTE'] },
            f.actor,
          ),
        ).rejects.toMatchObject({ status: 400 });
        await expect(
          catalogo.crear(
            { codigo: 'QA_EXTRA', nombre: 'Extra', grupoId: randomUUID() },
            f.actor,
          ),
        ).rejects.toMatchObject({ status: 400 });
        expect(
          (
            await catalogo.crear(
              {
                codigo: 'QA_EXTRA',
                nombre: 'Extra',
                grupoId: f.grupos.CRM,
                requiere: ['LEADS'],
              },
              f.actor,
            )
          ).requiere,
        ).toEqual(['LEADS']);
      }));
    it('/auth/me incluye grupo; retirar grupo revoca acceso efectivo', () =>
      fixture(async (f) => {
        await f.repo.toggleGrupo(f.org, f.grupos.CRM, true, f.actor);
        const auth = new PrismaModulosRepository(f.client);
        expect(
          (await auth.findModulosPorOrganizacion(f.org)).every(
            (m) => m.grupo === 'CRM',
          ),
        ).toBe(true);
        await f.tx.moduloGrupo.update({
          where: { id: f.grupos.CRM },
          data: { estado: 0 },
        });
        expect(await auth.findModulosPorOrganizacion(f.org)).toEqual([]);
      }));
    it('GET /leads retorna 403 apagado y 200 encendido con el guard real', () =>
      fixture(async (f) => {
        const tipos = Reflect.getMetadata(
          PARAMTYPES_METADATA,
          LeadsController,
        ) as unknown[];
        const injectados = Reflect.getMetadata(
          SELF_DECLARED_DEPS_METADATA,
          LeadsController,
        ) as { index: number; param: unknown }[];
        const dependencias = [...tipos];
        for (const d of injectados ?? []) dependencias[d.index] = d.param;
        const module = await Test.createTestingModule({
          controllers: [LeadsController],
          providers: [
            { provide: PrismaService, useValue: f.client },
            ModuleGuard,
            ...dependencias.map((provide) => ({
              provide: provide as never,
              useValue: { execute: () => Promise.resolve([]) },
            })),
          ],
        })
          .overrideGuard(JwtAuthGuard)
          .useValue({
            canActivate: (ctx: ExecutionContext) => {
              ctx.switchToHttp().getRequest<{ user?: unknown }>().user = {
                usuarioId: f.actor,
                organizacionId: f.org,
                rol: 'PROPIETARIO',
              };
              return true;
            },
          })
          .overrideGuard(OrgMembershipGuard)
          .useValue({ canActivate: () => true })
          .overrideGuard(RolesGuard)
          .useValue({ canActivate: () => true })
          .compile();
        const app = module.createNestApplication();
        await app.init();
        try {
          await request(app.getHttpServer() as App)
            .get('/leads')
            .expect(403);
          await f.repo.toggle(f.org, f.ids.LEADS, true, f.actor);
          await request(app.getHttpServer() as App)
            .get('/leads')
            .expect(200);
          await f.tx.moduloGrupo.update({
            where: { id: f.grupos.CRM },
            data: { estado: 0 },
          });
          await request(app.getHttpServer() as App)
            .get('/leads')
            .expect(403);
        } finally {
          await app.close();
        }
      }));
    it('ingresa leads Meta y WhatsApp con LEADS apagado; webhook no lleva guard de módulos', () =>
      fixture(async (f) => {
        expect(
          Reflect.getMetadata(REQUIRE_MODULE_KEY, MetaWebhooksController),
        ).toBeUndefined();
        expect(
          Reflect.getMetadata(GUARDS_METADATA, MetaWebhooksController) ?? [],
        ).not.toContain(ModuleGuard);
        await f.repo.toggle(f.org, f.ids.LEADS, false, f.actor);
        const meta = new PrismaLeadsRepository(f.client);
        const resultado = await meta.upsertPorIdExterno({
          organizacionId: f.org,
          idExterno: randomUUID(),
          nombre: 'QA Meta',
          datosCrudos: {},
        });
        expect(resultado.creado).toBe(true);
        const whatsapp = new PrismaLeadsGestionRepository(f.client);
        const wa = await whatsapp.crearDesdeWhatsApp({
          organizacionId: f.org,
          idExterno: randomUUID(),
          nombre: 'QA WhatsApp',
          email: null,
          telefono: null,
          tipoLead: null,
          datosCrudos: {},
          usuarioId: null,
          asignadoUsuarioId: null,
          historialId: randomUUID(),
        });
        expect(wa.creado).toBe(true);
        expect(
          await f.tx.lead.count({ where: { organizacionId: f.org } }),
        ).toBe(2);
      }));
  },
);
