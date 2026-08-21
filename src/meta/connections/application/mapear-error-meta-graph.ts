import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { MATRIZ_PERMISOS_META } from './meta-permisos-matriz';

/** Payload típico de error de Graph API. */
export interface MetaGraphErrorBody {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_title?: string;
  error_user_msg?: string;
  fbtrace_id?: string;
}

const LABELS_SCOPE: Record<string, string> = Object.fromEntries(
  MATRIZ_PERMISOS_META.flatMap((f) =>
    f.scopesRequeridos.map((scope) => [scope, f.label] as const),
  ),
);

/** Extrae nombres de permiso del mensaje crudo de Meta. */
function extraerPermisosMencionados(mensaje: string): string[] {
  const scopes = new Set<string>();
  const requires = mensaje.matchAll(
    /Requires?\s+[`'"]?([a-z0-9_]+)[`'"]?\s+permission/gi,
  );
  for (const match of requires) scopes.add(match[1].toLowerCase());

  const missing = mensaje.matchAll(
    /missing\s+(?:the\s+)?[`'"]?([a-z0-9_]+)[`'"]?\s+permission/gi,
  );
  for (const match of missing) scopes.add(match[1].toLowerCase());

  const thisEndpoint = mensaje.matchAll(
    /requires the [`'"]([a-z0-9_]+)[`'] permission/gi,
  );
  for (const match of thisEndpoint) scopes.add(match[1].toLowerCase());

  return [...scopes];
}

function labelDeScope(scope: string): string {
  return LABELS_SCOPE[scope] ?? scope;
}

function mensajePermisoFaltante(scopes: string[], mensajeMeta: string): string {
  if (scopes.length === 0) {
    return (
      'Meta rechazó la operación por falta de permisos. ' +
      'Revisa Permisos Meta en Conexión, activa lo necesario y pulsa «Otorgar en Meta».'
    );
  }

  const detalle = scopes
    .map((s) => `«${labelDeScope(s)}» (${s})`)
    .join(', ');

  return (
    `Falta el permiso ${detalle}. ` +
    `Actívalo en Configuración → Meta → Conexión (Permisos Meta) y pulsa «Otorgar en Meta». ` +
    `(Detalle Meta: ${mensajeMeta})`
  );
}

/** Meta casi nunca usa HTTP 429 real — el rate limit suele venir como HTTP 400
 * con uno de estos códigos en el body. Se usa para decidir reintentos en el cliente. */
export function esRateLimitMeta(error: unknown): boolean {
  if (!(error instanceof AxiosError)) return false;
  const code = (error.response?.data as { error?: MetaGraphErrorBody } | undefined)
    ?.error?.code;
  return (
    error.response?.status === 429 ||
    code === 4 ||
    code === 17 ||
    code === 32 ||
    code === 613 ||
    code === 80004 ||
    code === 80005
  );
}

/**
 * Traduce un error de Graph/Axios a HttpException Nest con mensaje usable en UI.
 * Códigos frecuentes: 190 token, 10/200 permisos, 4/17/32 rate limit, 100 parámetro.
 */
export function excepcionDesdeErrorMeta(error: unknown): HttpException {
  if (!(error instanceof AxiosError)) {
    return new BadGatewayException(
      'Error desconocido al llamar a Meta Graph API',
    );
  }

  const body = error.response?.data as { error?: MetaGraphErrorBody } | undefined;
  const graph = body?.error;
  const mensajeMeta =
    graph?.error_user_msg?.trim() ||
    graph?.message?.trim() ||
    error.message ||
    'Error desconocido';
  const code = graph?.code;
  const subcode = graph?.error_subcode;
  const permisos = extraerPermisosMencionados(mensajeMeta);

  // Token inválido / expirado / sesión
  if (
    code === 190 ||
    code === 102 ||
    subcode === 463 ||
    subcode === 467 ||
    /access token|session has|OAuthException/i.test(mensajeMeta)
  ) {
    return new UnauthorizedException(
      'La sesión con Meta expiró o el token no es válido. Desconecta y vuelve a conectar Meta.',
    );
  }

  // Rate limiting
  if (
    error.response?.status === 429 ||
    code === 4 ||
    code === 17 ||
    code === 32 ||
    code === 613 ||
    code === 80004 ||
    code === 80005
  ) {
    return new HttpException(
      'Meta está limitando las peticiones (rate limit). Espera un momento e inténtalo de nuevo.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  // Permisos (#10, #200, #294, mensajes "Requires X permission")
  if (
    code === 10 ||
    code === 200 ||
    code === 294 ||
    permisos.length > 0 ||
    /permission|permissions error|(#200)/i.test(mensajeMeta)
  ) {
    return new ForbiddenException(
      mensajePermisoFaltante(permisos, mensajeMeta),
    );
  }

  // Objeto inexistente / sin acceso
  if (
    code === 100 ||
    code === 803 ||
    /does not exist|cannot be loaded due to missing permission/i.test(
      mensajeMeta,
    )
  ) {
    if (permisos.length > 0 || /permission/i.test(mensajeMeta)) {
      return new ForbiddenException(
        mensajePermisoFaltante(permisos, mensajeMeta),
      );
    }
    return new BadGatewayException(
      `Meta no pudo cargar el recurso (puede no existir o no tener acceso). ${mensajeMeta}`,
    );
  }

  // Bloqueo temporal / abuso
  if (code === 368) {
    return new ForbiddenException(
      'Meta bloqueó temporalmente esta acción. Revisa el estado de la página/cuenta en Meta Business Suite e inténtalo más tarde.',
    );
  }

  if (graph?.error_user_title && graph.error_user_msg) {
    return new BadGatewayException(
      `${graph.error_user_title}: ${graph.error_user_msg}`,
    );
  }

  return new BadGatewayException(`Meta Graph API: ${mensajeMeta}`);
}
