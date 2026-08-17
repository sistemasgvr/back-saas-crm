import type { MetaConexion } from '@prisma/client';

// token_cifrado, app_secret_cifrado y webhook_verify_token NUNCA se exponen
// al frontend (PLAN.md §3.6).
export function toConexionResponse(conexion: MetaConexion | null) {
  if (!conexion) {
    return { appConfigurada: false as const, conectado: false as const };
  }

  return {
    appConfigurada: !!conexion.appId,
    appId: conexion.appId,
    conectado: !!conexion.metaUserId,
    id: conexion.id,
    metaUserNombre: conexion.metaUserNombre,
    pageId: conexion.pageId,
    pageNombre: conexion.pageNombre,
    adAccountId: conexion.adAccountId,
    adAccountNombre: conexion.adAccountNombre,
    tokenExpiraEn: conexion.tokenExpiraEn,
    fechaCreacion: conexion.fechaCreacion,
  };
}
