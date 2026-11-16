import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { catchError } from 'rxjs';
import { mensajeSolapeVisita } from '../domain/agenda-visitas';

@Injectable()
export class AgendaConflictInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      catchError((error: unknown) => {
        if (
          (error instanceof Prisma.PrismaClientKnownRequestError ||
            error instanceof Prisma.PrismaClientUnknownRequestError) &&
          error.message.includes('CRM_AGENDA_SOLAPE')
        ) {
          throw new ConflictException(mensajeSolapeVisita());
        }
        throw error;
      }),
    );
  }
}
