import { randomUUID } from 'crypto';
import type { IncomingMessage } from 'http';
import pino, { type LoggerOptions } from 'pino';
import type { Options } from 'pino-http';

/** Evita que URLs de Graph/DB y mensajes de error publiquen credenciales. */
export function sanitizeLogText(value: string): string {
  return value
    .replace(
      /([?&](?:access_token|token|client_secret|appsecret_proof|code|hub\.verify_token)=)[^&\s"']*/gi,
      '$1[REDACTED]',
    )
    .replace(/(Bearer\s+)[\w.-]+/gi, '$1[REDACTED]')
    .replace(
      /((?:postgres(?:ql)?|https?):\/\/)[^\s/@]+:[^\s/@]+@/gi,
      '$1[REDACTED]@',
    );
}

export function createLoggerOptions(
  level = process.env.LOG_LEVEL,
): LoggerOptions {
  const validLevel = [
    'trace',
    'debug',
    'info',
    'warn',
    'error',
    'fatal',
    'silent',
  ].includes(level ?? '');
  return {
    level: validLevel ? level : 'info',
    base: { service: 'back-saas-crm', pid: process.pid },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
    redact: {
      paths: [
        'req.headers',
        'req.body',
        'req.rawBody',
        'req.query',
        'res.headers',
        'body',
        'rawBody',
        'password',
        'token',
        'accessToken',
        'access_token',
        'refreshToken',
        'secret',
        'appSecret',
        'client_secret',
        '*.password',
        '*.token',
        '*.accessToken',
        '*.access_token',
        '*.refreshToken',
        '*.secret',
        '*.appSecret',
        '*.client_secret',
        'err.config',
        'err.request',
        'err.response',
      ],
      remove: true,
    },
    hooks: {
      logMethod(args, method) {
        method.apply(
          this,
          args.map((arg) =>
            typeof arg === 'string' ? sanitizeLogText(arg) : arg,
          ),
        );
      },
    },
    serializers: {
      err: (error: Error & { code?: string | number }) => ({
        type: error?.name,
        message: sanitizeLogText(error?.message ?? String(error)),
        stack: error?.stack ? sanitizeLogText(error.stack) : undefined,
        code: error?.code,
      }),
    },
  };
}

export function createHttpLoggerOptions(level?: string): Options {
  const options = createLoggerOptions(level);
  return {
    ...options,
    wrapSerializers: false,
    genReqId(req, res) {
      const supplied = req.headers['x-request-id'];
      const id =
        typeof supplied === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(supplied)
          ? supplied
          : randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    customLogLevel: (_req, res, error) =>
      error || res.statusCode >= 500
        ? 'error'
        : res.statusCode >= 400
          ? 'warn'
          : 'info',
    customSuccessMessage: () => 'Solicitud HTTP completada',
    customErrorMessage: () => 'Solicitud HTTP fallida',
    serializers: {
      ...options.serializers,
      req: (req: IncomingMessage & { id?: string; originalUrl?: string }) => ({
        id: req.id,
        method: req.method,
        url: (req.originalUrl ?? req.url ?? '').split('?')[0],
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  };
}
