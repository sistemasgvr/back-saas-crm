export const META_ELIMINACION_DATOS_REPOSITORY = Symbol(
  'META_ELIMINACION_DATOS_REPOSITORY',
);

export type TipoSolicitudEliminacion = 'DATA_DELETION' | 'DEAUTHORIZE';
export type EstadoSolicitudEliminacion =
  | 'PENDIENTE'
  | 'PROCESADA'
  | 'NO_ENCONTRADA';

export interface MetaSolicitudEliminacionRow {
  id: string;
  confirmationCode: string;
  metaUserId: string;
  organizacionId: string | null;
  metaConexionId: string | null;
  tipo: string;
  estado: string;
  detalle: string | null;
  fechaCreacion: Date;
  fechaProcesada: Date | null;
}

export interface CrearSolicitudEliminacionInput {
  confirmationCode: string;
  metaUserId: string;
  organizacionId: string | null;
  metaConexionId: string | null;
  tipo: TipoSolicitudEliminacion;
  estado: EstadoSolicitudEliminacion;
  detalle: string | null;
}

export interface MetaEliminacionDatosRepository {
  crear(
    input: CrearSolicitudEliminacionInput,
  ): Promise<MetaSolicitudEliminacionRow>;
  findPorConfirmationCode(
    code: string,
  ): Promise<MetaSolicitudEliminacionRow | null>;
}
