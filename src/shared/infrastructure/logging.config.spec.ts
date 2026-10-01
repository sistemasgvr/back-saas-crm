import { Writable } from 'stream';
import type { Server } from 'http';
type LogRecord = {
  level?: string;
  context?: string;
  req?: { id?: string; method?: string; url?: string };
  res?: { statusCode?: number };
  responseTime?: number;
  err?: { message?: string; stack?: string };
};
import {
  Controller,
  Get,
  Post,
  HttpCode,
  InternalServerErrorException,
  Logger,
  Module,
  Req,
} from '@nestjs/common';
import type { INestApplication, RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Test } from '@nestjs/testing';
import {
  LoggerModule,
  Logger as PinoNestLogger,
  LoggerErrorInterceptor,
} from 'nestjs-pino';
import request from 'supertest';
import pino from 'pino';
import {
  createHttpLoggerOptions,
  createLoggerOptions,
  sanitizeLogText,
} from './logging.config';

@Controller()
class LoggingTestController {
  private readonly logger = new Logger(LoggingTestController.name);
  @Post('meta/webhooks')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>) {
    this.logger.log('Webhook recibido');
    return { rawBodyAvailable: Buffer.isBuffer(req.rawBody) };
  }
  @Get('denied')
  @HttpCode(403)
  denied() {
    return 'Forbidden';
  }
  @Get('failure')
  failure() {
    throw new InternalServerErrorException('Fallo de prueba');
  }
}

describe('Pino: HTTP, contexto y privacidad', () => {
  let app: INestApplication<Server>;
  let output: string;
  const logs = () =>
    output
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as LogRecord);

  beforeAll(async () => {
    output = '';
    const stream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        output += chunk.toString();
        done();
      },
    });
    @Module({
      imports: [
        LoggerModule.forRoot({
          pinoHttp: [createHttpLoggerOptions('info'), stream],
        }),
      ],
      controllers: [LoggingTestController],
    })
    class LoggingTestModule {}
    const module = await Test.createTestingModule({
      imports: [LoggingTestModule],
    }).compile();
    app = module.createNestApplication({ rawBody: true, bufferLogs: true });
    app.useLogger(app.get(PinoNestLogger));
    app.useGlobalInterceptors(new LoggerErrorInterceptor());
    await app.init();
  });
  beforeEach(() => {
    output = '';
  });
  afterAll(async () => {
    await app.close();
    Logger.overrideLogger(new Logger());
  });

  it('registra HTTP y logs del servicio con el mismo ID, sin secretos ni body', async () => {
    const response = await request(app.getHttpServer())
      .post('/meta/webhooks?token=SECRET_URL&hub.verify_token=SECRET_VERIFY')
      .set('x-request-id', 'test-request-123')
      .set('Authorization', 'Bearer SECRET_AUTH')
      .set('Cookie', 'session=SECRET_COOKIE')
      .set('X-Hub-Signature-256', 'sha256=SECRET_SIGNATURE')
      .send({ text: 'PRIVATE_MESSAGE', password: 'SECRET_PASSWORD' })
      .expect(200);
    expect(
      (response.body as { rawBodyAvailable: boolean }).rawBodyAvailable,
    ).toBe(true);
    expect(response.headers['x-request-id']).toBe('test-request-123');
    const records = logs();
    expect(
      records.filter((log) => log.responseTime !== undefined),
    ).toHaveLength(1);
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          context: 'LoggingTestController',
          req: {
            id: 'test-request-123',
            method: 'POST',
            url: '/meta/webhooks',
          },
        }),
        expect.objectContaining({
          level: 'info',
          res: { statusCode: 200 },
        }),
      ]),
    );
    expect(
      typeof records.find((log) => log.res?.statusCode === 200)?.responseTime,
    ).toBe('number');
    expect(output).not.toMatch(/SECRET_|PRIVATE_MESSAGE/);
  });

  it('registra 403 como warn y genera un UUID si no hay ID confiable', async () => {
    const response = await request(app.getHttpServer())
      .get('/denied')
      .set('x-request-id', 'invalid id!')
      .expect(403);
    expect(response.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
    expect(logs()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: 'warn', res: { statusCode: 403 } }),
      ]),
    );
  });

  it('registra errores 500 y su stack', async () => {
    await request(app.getHttpServer()).get('/failure').expect(500);
    expect(
      logs().find((log) => log.res?.statusCode === 500)?.err?.message,
    ).toBe('Fallo de prueba');
    expect(
      typeof logs().find((log) => log.res?.statusCode === 500)?.err?.stack,
    ).toBe('string');
    expect(logs()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'error',
          res: { statusCode: 500 },
        }),
      ]),
    );
  });

  it('redacta credenciales también en mensajes y errores de clientes externos', () => {
    let written = '';
    const stream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        written += chunk.toString();
        done();
      },
    });
    const logger = pino(createLoggerOptions('info'), stream);
    logger.error(
      {
        err: Object.assign(
          new Error(
            'https://graph.facebook.com/v26.0?access_token=SECRET_TOKEN',
          ),
          { config: { headers: { Authorization: 'SECRET_HEADER' } } },
        ),
        token: 'SECRET_ROOT',
      },
      'Bearer SECRET_BEARER',
    );
    expect(written).not.toContain('SECRET_');
    expect(written).toContain('[REDACTED]');
    expect(sanitizeLogText('postgresql://user:pass@db/crm')).toBe(
      'postgresql://[REDACTED]@db/crm',
    );
  });
});
