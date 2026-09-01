import type { MetaConexion } from '@prisma/client';

// token_cifrado, app_secret_cifrado y webhook_verify_token NUNCA se exponen
// al frontend (PLAN.md §3.6).
export function toConexionResponse(
  conexion: MetaConexion | null,
  paginasActivas: number,
  cuentasActivas: number,
) {
  if (!conexion) {
    return { appConfigurada: false as const, conectado: false as const };
  }

  return {
    appConfigurada: !!conexion.appId,
    appId: conexion.appId,
    conectado: !!conexion.metaUserId,
    id: conexion.id,
    metaUserNombre: conexion.metaUserNombre,
    paginasActivas,
    cuentasActivas,
    tokenExpiraEn: conexion.tokenExpiraEn,
    fechaCreacion: conexion.fechaCreacion,
    capiDatasetId: conexion.capiDatasetId,
  };
}
