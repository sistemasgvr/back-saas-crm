import type { MetaConexion } from '@prisma/client';

export const META_CONEXIONES_REPOSITORY = Symbol('META_CONEXIONES_REPOSITORY');

export interface GuardarCredencialesInput {
  organizacionId: string;
  appId: string;
  appSecretCifrado: string;
  usuarioEdicion: string;
}

export interface ActualizarTokenInput {
  organizacionId: string;
  metaUserId: string;
  metaUserNombre?: string;
  tokenCifrado: string;
  tokenExpiraEn?: Date;
  scopes?: string;
  usuarioEdicion: string;
}

export interface MetaConexionesRepository {
  findActivaPorOrganizacion(
    organizacionId: string,
  ): Promise<MetaConexion | null>;
  findActivaPorPageId(pageId: string): Promise<MetaConexion | null>;
  findActivaPorWebhookVerifyToken(token: string): Promise<MetaConexion | null>;
  listActivasConAppSecret(): Promise<MetaConexion[]>;
  /** Crea la fila si no existe, o reemplaza App ID/Secret si ya existía (rotación de credenciales). */
  guardarCredencialesApp(
    input: GuardarCredencialesInput,
  ): Promise<MetaConexion>;
  /** Completa los campos de OAuth sobre una fila que ya tiene appId/appSecret guardados. */
  actualizarTokenOAuth(input: ActualizarTokenInput): Promise<MetaConexion>;
  /** Revoca la sesión OAuth (metaUserId/token/página/cuenta) pero conserva appId/appSecret. */
  limpiarConexionOAuth(id: string, usuarioEdicion: string): Promise<void>;
  /** Preferencia de features opt-in a solicitar en OAuth (PLAN.md Fase 16). */
  actualizarFeaturesDeseadas(
    id: string,
    featuresDeseadas: string[],
    usuarioEdicion: string,
  ): Promise<void>;
}
