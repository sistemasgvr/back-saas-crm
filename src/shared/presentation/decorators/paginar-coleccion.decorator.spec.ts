import { BadRequestException, type ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { PaginacionColeccionInterceptor } from './paginar-coleccion.decorator';

describe('Paginación de catálogos calculados', () => {
  const interceptor = new PaginacionColeccionInterceptor();
  const context = (query: Record<string, unknown>) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ query }) }),
    }) as ExecutionContext;

  it('permite llegar al último elemento y conserva el total completo', async () => {
    const items = Array.from({ length: 105 }, (_, i) => i + 1);
    const result = await firstValueFrom(
      interceptor.intercept(context({ page: '6', pageSize: '20' }), {
        handle: () => of(items),
      }),
    );
    expect(result).toEqual({
      data: [101, 102, 103, 104, 105],
      total: 105,
      page: 6,
      pageSize: 20,
      totalPages: 6,
    });
  });

  it('responde con una página vacía consistente', async () => {
    expect(
      await firstValueFrom(
        interceptor.intercept(context({}), { handle: () => of([]) }),
      ),
    ).toEqual({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 1 });
  });

  it.each([
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { page: 'NaN' },
    { pageSize: '101' },
    { pageSize: '0' },
  ])(
    'rechaza parámetros inválidos antes de ejecutar la consulta: %p',
    (query) => {
      const handle = jest.fn(() => of([]));
      expect(() => interceptor.intercept(context(query), { handle })).toThrow(
        BadRequestException,
      );
      expect(handle).not.toHaveBeenCalled();
    },
  );
});
