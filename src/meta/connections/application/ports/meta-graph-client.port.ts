export const META_GRAPH_CLIENT = Symbol('META_GRAPH_CLIENT');

export interface TokenIntercambiado {
  accessToken: string;
  expiraEnSegundos?: number;
}

export interface MetaUsuario {
  id: string;
  nombre: string;
}

export interface MetaPagina {
  id: string;
  nombre: string;
}

export interface MetaCuentaPublicitaria {
  id: string;
  nombre: string;
}

export interface MetaGraphClient {
  intercambiarCodigoPorToken(code: string, redirectUri: string): Promise<TokenIntercambiado>;
  intercambiarPorTokenLargaDuracion(shortLivedToken: string): Promise<TokenIntercambiado>;
  obtenerUsuario(accessToken: string): Promise<MetaUsuario>;
  listarPaginas(accessToken: string): Promise<MetaPagina[]>;
  listarCuentasPublicitarias(accessToken: string): Promise<MetaCuentaPublicitaria[]>;
}
