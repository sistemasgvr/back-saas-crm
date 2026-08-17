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

export interface MetaCampoLead {
  name: string;
  values: string[];
}

export interface MetaLeadGraph {
  leadgenId: string;
  formId?: string;
  adId?: string;
  adsetId?: string;
  campaignId?: string;
  createdTime?: Date;
  fieldData: MetaCampoLead[];
  raw: unknown;
}

export interface MetaGraphClient {
  /** appId/appSecret son de la Meta App propia de la organización, no de la plataforma. */
  intercambiarCodigoPorToken(
    code: string,
    redirectUri: string,
    appId: string,
    appSecret: string,
  ): Promise<TokenIntercambiado>;
  intercambiarPorTokenLargaDuracion(
    shortLivedToken: string,
    appId: string,
    appSecret: string,
  ): Promise<TokenIntercambiado>;
  obtenerUsuario(accessToken: string): Promise<MetaUsuario>;
  listarPaginas(accessToken: string): Promise<MetaPagina[]>;
  listarCuentasPublicitarias(accessToken: string): Promise<MetaCuentaPublicitaria[]>;
  obtenerLead(leadgenId: string, accessToken: string): Promise<MetaLeadGraph>;
}
