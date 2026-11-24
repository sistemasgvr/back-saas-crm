import { EventEmitter } from 'events';
import { createHmac } from 'node:crypto';
import type { Server } from 'http';
import type { Response } from 'express';
import type { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import {
  Controller,
  ForbiddenException,
  Get,
  Global,
  Injectable,
  Module,
  Post,
  Req,
  UseGuards,
  type CanActivate,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpAuditService } from './http-audit.service';
import {
  HttpAuditMiddleware,
  type AuditRequest,
} from './http-audit.middleware';
import { HttpAuditModule } from './http-audit.module';
import { PrismaService } from './prisma.service';

@Injectable()
class DenyGuard implements CanActivate {
  canActivate(): boolean {
    throw new ForbiddenException('Acceso revocado');
  }
}
@Controller('audit-test')
class AuditController {
  @Post(':id')
  success(@Req() req: AuditRequest) {
    req.user = {
      usuarioId: '11111111-1111-4111-8111-111111111111',
      organizacionId: '22222222-2222-4222-8222-222222222222',
      sesionId: '33333333-3333-4333-8333-333333333333',
      esAdminPlataforma: false,
    };
    return { accessToken: 'response-secret' };
  }
  @Get('denied')
  @UseGuards(DenyGuard)
  denied() {
    return {};
  }
  @Get('failure')
  failure() {
    throw new Error('password=private-sql-value');
  }
}

describe('Historial HTTP persistido', () => {
  const forwardingSecret = 'synthetic-private-key-with-at-least-32-characters';
  let app: INestApplication<Server>;
  let audit: HttpAuditService;
  type Batch = {
    data: Prisma.RegistroHttpCreateManyInput[];
    skipDuplicates: boolean;
  };
  const createMany = jest
    .fn<Promise<{ count: number }>, [Batch]>()
    .mockResolvedValue({ count: 1 });
  const execute = jest
    .fn<Promise<number>, [TemplateStringsArray, Date]>()
    .mockResolvedValue(0);
  const lock = jest
    .fn<Promise<{ adquirido: boolean }[]>, [TemplateStringsArray]>()
    .mockResolvedValue([{ adquirido: true }]);
  const prisma = {
    registroHttp: { createMany },
    $transaction: jest.fn(
      (
        fn: (tx: {
          $queryRaw: typeof lock;
          $executeRaw: typeof execute;
        }) => Promise<void>,
      ) => fn({ $queryRaw: lock, $executeRaw: execute }),
    ),
  };
  beforeAll(async () => {
    @Global()
    @Module({
      providers: [
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            HTTP_AUDIT_ENABLED: true,
            CLIENT_IP_FORWARD_SECRET: forwardingSecret,
          }),
        },
      ],
      exports: [PrismaService, ConfigService],
    })
    class AuditDependencies {}
    const module = await Test.createTestingModule({
      imports: [AuditDependencies, HttpAuditModule],
      controllers: [AuditController],
      providers: [DenyGuard],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({
          HTTP_AUDIT_ENABLED: true,
          CLIENT_IP_FORWARD_SECRET: forwardingSecret,
        }),
      )
      .compile();
    app = module.createNestApplication({ logger: false });
    audit = app.get(HttpAuditService);
    await app.init();
    await audit.limpiar();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    createMany.mockClear();
  });

  it('guarda identidad verificada, JSON de metadatos y correlación sin contenido ni secretos', async () => {
    const response = await request(app.getHttpServer())
      .post('/audit-test/abc?access_token=query-secret')
      .set('x-request-id', 'request-test-123')
      .set('authorization', 'Bearer header-secret')
      .set('cookie', 'session=cookie-secret')
      .set('x-forwarded-for', '38.56.219.133')
      .send({ texto: 'message-secret', password: 'body-secret' })
      .expect(201);
    await audit.flush();
    const data = createMany.mock.calls.flatMap(([call]) => call.data);
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      requestId: response.headers['x-request-id'],
      estadoHttp: 201,
      abortada: false,
      sesionId: '33333333-3333-4333-8333-333333333333',
      solicitud: {
        metodo: 'POST',
        ruta: '/audit-test/abc',
        rutaPlantilla: '/audit-test/:id',
      },
    });
    expect(data[0].ip).not.toBe('38.56.219.133'); // No confiar en XFF sin configurar proxy.
    expect(JSON.stringify(data)).not.toMatch(
      /query-secret|header-secret|cookie-secret|body-secret|message-secret|response-secret/,
    );
  });

  it('captura rechazos de guards y 404 aunque no llegue al controlador', async () => {
    await request(app.getHttpServer()).get('/audit-test/denied').expect(403);
    await request(app.getHttpServer()).get('/missing').expect(404);
    await audit.flush();
    const data = createMany.mock.calls.flatMap(([call]) => call.data);
    expect(data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          estadoHttp: 403,
          errorMensaje: 'Acceso revocado',
        }),
        expect.objectContaining({ estadoHttp: 404 }),
      ]),
    );
  });

  it('persiste la IP y el navegador firmados sin reemplazar el peer de conexión', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', forwardingSecret)
      .update(
        [
          timestamp,
          'POST',
          '/audit-test/abc',
          '38.56.219.133',
          'Browser/test',
        ].join('\n'),
      )
      .digest('hex');
    await request(app.getHttpServer())
      .post('/audit-test/abc')
      .set('x-crm-client-ip', '38.56.219.133')
      .set('x-crm-client-agent', 'Browser/test')
      .set('x-crm-client-ts', timestamp)
      .set('x-crm-client-signature', signature)
      .send({ texto: 'not-recorded' })
      .expect(201);
    await audit.flush();
    const [row] = createMany.mock.calls.flatMap(([call]) => call.data);
    expect(row).toMatchObject({
      ip: '38.56.219.133',
      solicitud: { ipOrigen: 'frontend_firmado', userAgent: 'Browser/test' },
    });
    expect(JSON.stringify(row.solicitud)).not.toContain(signature);
    expect(JSON.stringify(row.solicitud)).not.toContain('not-recorded');
  });

  it('conserva frames del error interno sin almacenar su contenido arbitrario', async () => {
    await request(app.getHttpServer()).get('/audit-test/failure').expect(500);
    await audit.flush();
    const data = createMany.mock.calls.flatMap(([call]) => call.data);
    expect(data[0]).toMatchObject({
      estadoHttp: 500,
      errorTipo: 'Error',
      errorMensaje: 'Error interno del servidor',
    });
    expect(data[0].errorStack).toContain('at ');
    expect(JSON.stringify(data)).not.toContain('private-sql-value');
  });

  it('registra una desconexión una sola vez como 499', () => {
    const registrar = jest.fn<void, [Prisma.RegistroHttpCreateManyInput]>();
    const middleware = new HttpAuditMiddleware({
      habilitado: true,
      registrar,
    } as unknown as HttpAuditService);
    const res = Object.assign(new EventEmitter(), {
      setHeader: jest.fn(),
      writableFinished: false,
      statusCode: 200,
    });
    middleware.use(
      {
        headers: {},
        method: 'GET',
        originalUrl: '/abort',
        socket: {},
        get: jest.fn(),
      } as unknown as AuditRequest,
      res as unknown as Response,
      jest.fn(),
    );
    res.emit('close');
    res.emit('finish');
    expect(registrar).toHaveBeenCalledTimes(1);
    expect(registrar.mock.calls[0][0]).toMatchObject({
      abortada: true,
      estadoHttp: 499,
    });
  });

  it('limpia únicamente filas mayores a 30 días con coordinación entre réplicas', async () => {
    execute.mockClear();
    const now = Date.now();
    await audit.limpiar();
    expect(lock).toHaveBeenCalled();
    const [sql, limite] = execute.mock.calls[0];
    expect(sql.join(' ')).toContain('WHERE fecha <');
    expect(limite.getTime()).toBeGreaterThanOrEqual(now - 30 * 86400000);
    expect(limite.getTime()).toBeLessThanOrEqual(Date.now() - 30 * 86400000);
    lock.mockResolvedValueOnce([{ adquirido: false }]);
    execute.mockClear();
    await audit.limpiar();
    expect(execute).not.toHaveBeenCalled();
  });

  it('reintenta el mismo lote tras caída de BD sin duplicar y drena al apagar', async () => {
    const storage = {
      registroHttp: {
        createMany: jest
          .fn<Promise<{ count: number }>, [Batch]>()
          .mockRejectedValueOnce(new Error('offline'))
          .mockResolvedValue({ count: 1 }),
      },
    };
    const service = new HttpAuditService(
      storage as unknown as PrismaService,
      new ConfigService(),
    );
    service.registrar({
      id: 'stable-id',
      requestId: 'retry-id',
      solicitud: {},
      estadoHttp: 200,
      duracionMs: 1,
    });
    await service.flush();
    await service.beforeApplicationShutdown();
    expect(storage.registroHttp.createMany).toHaveBeenCalledTimes(2);
    expect(storage.registroHttp.createMany.mock.calls[0]).toEqual(
      storage.registroHttp.createMany.mock.calls[1],
    );
    expect(
      storage.registroHttp.createMany.mock.calls[1][0].skipDuplicates,
    ).toBe(true);
  });
});
