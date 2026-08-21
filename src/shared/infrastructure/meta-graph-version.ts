import type { ConfigService } from '@nestjs/config';

/** Única fuente de la versión Graph usada por el diálogo OAuth y AxiosMetaGraphClient (Fase 14.0). */
export function obtenerVersionGraph(config: ConfigService): string {
  return config.get<string>('META_GRAPH_VERSION') ?? 'v26.0';
}
