export interface ResultadoPaginado<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function construirResultadoPaginado<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): ResultadoPaginado<T> {
  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
