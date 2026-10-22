import { Injectable } from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { tap } from 'rxjs';
import type { Observable } from 'rxjs';
import type { RequestContext } from '../../../auth/domain/request-context.interface';
import { TiempoRealChatsService } from '../application/tiempo-real-chats.service';

/** Ids de chat destino que algunas rutas reciben en el body (reenviar). */
function destinosDelBody(body: unknown): string[] {
  if (!body || typeof body !== 'object') return [];
  const { conversacionDestinoId, conversacionDestinoIds } = body as {
    conversacionDestinoId?: unknown;
    conversacionDestinoIds?: unknown;
  };
  const ids = Array.isArray(conversacionDestinoIds)
    ? conversacionDestinoIds
    : [conversacionDestinoId];
  return ids.filter((id): id is string => typeof id === 'string');
}

/**
 * Tras una acción exitosa sobre un chat desde el CRM (enviar, reaccionar,
 * reenviar, borrar, renombrar…), avisa en vivo a la org para que los demás
 * asesores con ese chat abierto lo vean sin esperar al polling. Solo en éxito:
 * un error no emite nada.
 */
@Injectable()
export class AvisarCambioChatInterceptor implements NestInterceptor {
  constructor(private readonly tiempoReal: TiempoRealChatsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestContext }>();
    return next.handle().pipe(
      tap(() => {
        const organizacionId = req.user?.organizacionId;
        if (!organizacionId) return;
        const ids = new Set([
          ...(typeof req.params?.id === 'string' ? [req.params.id] : []),
          ...destinosDelBody(req.body),
        ]);
        for (const conversacionId of ids) {
          this.tiempoReal.notificar(organizacionId, conversacionId, 'saliente');
        }
      }),
    );
  }
}
