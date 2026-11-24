import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import type { AuditRequest } from './http-audit.middleware';
import { sanitizeLogText } from './logging.config';

@Catch()
export class HttpAuditFilter extends BaseExceptionFilter {
  constructor(adapter: HttpAdapterHost) {
    super(adapter.httpAdapter);
  }

  catch(error: unknown, host: ArgumentsHost) {
    if (host.getType() === 'http') {
      const req = host.switchToHttp().getRequest<AuditRequest>();
      // Mensajes internos de Prisma/Axios pueden contener SQL, cuerpos o credenciales.
      // Guardar solo clasificación + frames; para HttpException guardar motivo público.
      const respuesta =
        error instanceof HttpException ? error.getResponse() : null;
      const mensaje =
        typeof respuesta === 'string'
          ? respuesta
          : respuesta && typeof respuesta === 'object' && 'message' in respuesta
            ? String(respuesta.message)
            : 'Error interno del servidor';
      req.auditError = {
        tipo: (error instanceof Error ? error.name : 'UnknownError').slice(
          0,
          120,
        ),
        mensaje: sanitizeLogText(mensaje).slice(0, 4000),
        stack:
          error instanceof Error
            ? sanitizeLogText(
                (error.stack ?? '')
                  .split('\n')
                  .filter((line) => /^\s+at /.test(line))
                  .join('\n'),
              ).slice(0, 12000)
            : undefined,
      };
    }
    super.catch(error, host);
  }
}
