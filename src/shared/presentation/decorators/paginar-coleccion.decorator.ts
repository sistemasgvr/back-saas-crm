import {
  applyDecorators,
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UseInterceptors,
} from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { map } from 'rxjs';
import { construirResultadoPaginado } from '../../application/paginacion';
import { PaginacionQueryDto } from '../dto/paginacion.query.dto';

/** Catálogos y resultados calculados que deben ordenarse completos antes de cortar.
 * Para tablas grandes usar count/skip/take en el repositorio. */
@Injectable()
export class PaginacionColeccionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const query = context
      .switchToHttp()
      .getRequest<{ query: Record<string, unknown> }>().query;
    const pagination = plainToInstance(PaginacionQueryDto, {
      ...(query.page !== undefined ? { page: query.page } : {}),
      ...(query.pageSize !== undefined ? { pageSize: query.pageSize } : {}),
    });
    const errors = validateSync(pagination);
    if (errors.length) {
      throw new BadRequestException(
        errors.flatMap((error) => Object.values(error.constraints ?? {})),
      );
    }
    const { page, pageSize } = pagination;
    return next
      .handle()
      .pipe(
        map((items: unknown[]) =>
          construirResultadoPaginado(
            items.slice((page - 1) * pageSize, page * pageSize),
            items.length,
            page,
            pageSize,
          ),
        ),
      );
  }
}

export function PaginarColeccion() {
  return applyDecorators(
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      minimum: 1,
      example: 1,
    }),
    ApiQuery({
      name: 'pageSize',
      required: false,
      type: Number,
      minimum: 1,
      maximum: 100,
      example: 20,
    }),
    UseInterceptors(PaginacionColeccionInterceptor),
  );
}
