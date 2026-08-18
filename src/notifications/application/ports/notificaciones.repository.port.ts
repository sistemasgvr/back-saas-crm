import type { ResultadoPaginado } from '../../../shared/application/paginacion';

export const NOTIFICACIONES_REPOSITORY = Symbol('NOTIFICACIONES_REPOSITORY');

export interface CrearNotificacionInput {
  organizacionId: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  payload?: Record<string, unknown>;
  usuarioIds: string[];
}

export interface NotificacionCreada {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  payload: unknown;
  fechaCreacion: Date;
  usuarioIds: string[];
}

export interface NotificacionListItem {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  payload: unknown;
  leida: boolean;
  fechaCreacion: Date;
  fechaLectura: Date | null;
}

export interface NotificacionesRepository {
  crearConFanOut(input: CrearNotificacionInput): Promise<NotificacionCreada>;
  listarPorUsuario(
    organizacionId: string,
    usuarioId: string,
    page: number,
    pageSize: number,
  ): Promise<ResultadoPaginado<NotificacionListItem>>;
  contarNoLeidas(organizacionId: string, usuarioId: string): Promise<number>;
  marcarLeida(
    organizacionId: string,
    usuarioId: string,
    notificacionUsuarioId: string,
  ): Promise<boolean>;
  marcarTodasLeidas(organizacionId: string, usuarioId: string): Promise<number>;
  findUsuarioIdsActivosDeOrganizacion(
    organizacionId: string,
  ): Promise<string[]>;
}
