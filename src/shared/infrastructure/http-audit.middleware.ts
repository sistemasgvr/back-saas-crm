import { Injectable, NestMiddleware, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Response, NextFunction } from 'express';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import { HttpAuditService } from './http-audit.service';
import {
  ClientIpService,
  requestClientIp,
  type ClientIpRequest,
} from './client-ip.service';

export type AuditRequest = ClientIpRequest & {
  id?: string;
  user?: RequestContext;
  auditError?: { tipo: string; mensaje: string; stack?: string };
};

@Injectable()
export class HttpAuditMiddleware implements NestMiddleware {
  constructor(
    private readonly audit: HttpAuditService,
    @Optional() private readonly ips?: ClientIpService,
  ) {}

  use(req: AuditRequest, res: Response, next: NextFunction) {
    this.ips?.resolve(req);
    if (!this.audit.habilitado) return next();
    const inicio = performance.now();
    const fecha = new Date();
    const supplied = req.id ?? req.headers['x-request-id'];
    const requestId =
      typeof supplied === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(supplied)
        ? supplied
        : randomUUID();
    // Comparte correlación con Pino, que reutiliza esta cabecera.
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
    let registrado = false;
    const terminar = () => {
      if (registrado) return;
      registrado = true;
      const abortada = !res.writableFinished;
      const route = req.route as { path?: unknown } | undefined;
      this.audit.registrar({
        id: randomUUID(),
        fecha,
        requestId,
        usuarioId: req.user?.usuarioId,
        organizacionId: req.user?.organizacionId,
        sesionId: req.user?.sesionId,
        solicitud: {
          metodo: req.method.slice(0, 16),
          ruta: (req.originalUrl || req.url).split('?')[0].slice(0, 2048),
          rutaPlantilla:
            typeof route?.path === 'string' ? route.path.slice(0, 512) : null,
          ipConexion: req.socket.remoteAddress?.slice(0, 64) ?? null,
          userAgent:
            (req.auditClientAgent ?? req.get('user-agent'))?.slice(0, 512) ??
            null,
          ipOrigen: req.auditIpSource ?? 'conexion',
          contentType: req.get('content-type')?.slice(0, 120) ?? null,
        },
        ip: requestClientIp(req)?.slice(0, 64),
        estadoHttp: abortada ? 499 : res.statusCode,
        duracionMs: Math.min(
          2147483647,
          Math.round(performance.now() - inicio),
        ),
        abortada,
        errorTipo: req.auditError?.tipo,
        errorMensaje: req.auditError?.mensaje,
        errorStack: req.auditError?.stack,
      });
    };
    res.once('finish', terminar);
    res.once('close', terminar);
    next();
  }
}
