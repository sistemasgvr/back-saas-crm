import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { RequestContext } from '../../../auth/domain/request-context.interface';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

const COLOR_METODO: Record<string, string> = {
  GET: '\x1b[34m', // azul
  POST: '\x1b[32m', // verde
  PATCH: '\x1b[33m', // amarillo
  PUT: '\x1b[33m', // amarillo
  DELETE: '\x1b[31m', // rojo
};

function colorEstado(status: number): string {
  if (status >= 500) return '\x1b[31m'; // rojo
  if (status >= 400) return '\x1b[33m'; // amarillo
  if (status >= 300) return '\x1b[36m'; // cian
  return '\x1b[32m'; // verde
}

/**
 * Loguea en consola cada solicitud HTTP entrante, en tiempo real, con método,
 * ruta, status, duración y (si la solicitud está autenticada) el usuario y
 * la organización que la hizo. Solo se registra en desarrollo — ver el
 * `configure()` de AppModule — no corre en producción.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const inicio = process.hrtime.bigint();

    res.on('finish', () => {
      const duracionMs = Number(process.hrtime.bigint() - inicio) / 1e6;
      const metodo = req.method;
      const colorMetodo = COLOR_METODO[metodo] ?? '\x1b[37m';
      const colorStatus = colorEstado(res.statusCode);
      const user = (req as Request & { user?: RequestContext }).user;
      const contexto = user
        ? `${DIM}usuario=${user.usuarioId.slice(0, 8)}${
            user.organizacionId ? ` org=${user.organizacionId.slice(0, 8)}` : ''
          }${RESET}`
        : '';

      this.logger.log(
        `${colorMetodo}${BOLD}${metodo.padEnd(6)}${RESET}${req.originalUrl} ` +
          `${colorStatus}${res.statusCode}${RESET} ${DIM}${duracionMs.toFixed(1)}ms${RESET} ${contexto}`.trim(),
      );
    });

    next();
  }
}
