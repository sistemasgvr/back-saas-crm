import { BadGatewayException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import type {
  MetaCuentaPublicitaria,
  MetaGraphClient,
  MetaLeadGraph,
  MetaPagina,
  MetaUsuario,
  TokenIntercambiado,
} from '../application/ports/meta-graph-client.port';

const GRAPH_BASE_URL = 'https://graph.facebook.com/v21.0';

interface GraphTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

interface GraphListResponse<T> {
  data: T[];
}

@Injectable()
export class AxiosMetaGraphClient implements MetaGraphClient {
  constructor(private readonly http: HttpService) {}

  async intercambiarCodigoPorToken(
    code: string,
    redirectUri: string,
    appId: string,
    appSecret: string,
  ): Promise<TokenIntercambiado> {
    const data = await this.get<GraphTokenResponse>('/oauth/access_token', {
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    });
    return { accessToken: data.access_token, expiraEnSegundos: data.expires_in };
  }

  async intercambiarPorTokenLargaDuracion(
    shortLivedToken: string,
    appId: string,
    appSecret: string,
  ): Promise<TokenIntercambiado> {
    const data = await this.get<GraphTokenResponse>('/oauth/access_token', {
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortLivedToken,
    });
    return { accessToken: data.access_token, expiraEnSegundos: data.expires_in };
  }

  async obtenerUsuario(accessToken: string): Promise<MetaUsuario> {
    const data = await this.get<{ id: string; name: string }>('/me', {
      fields: 'id,name',
      access_token: accessToken,
    });
    return { id: data.id, nombre: data.name };
  }

  async listarPaginas(accessToken: string): Promise<MetaPagina[]> {
    const data = await this.get<GraphListResponse<{ id: string; name: string }>>('/me/accounts', {
      fields: 'id,name',
      access_token: accessToken,
    });
    return data.data.map((pagina) => ({ id: pagina.id, nombre: pagina.name }));
  }

  async obtenerAccessTokenPagina(pageId: string, userAccessToken: string): Promise<string | null> {
    const data = await this.get<
      GraphListResponse<{ id: string; access_token?: string }>
    >('/me/accounts', {
      fields: 'id,access_token',
      access_token: userAccessToken,
    });
    const pagina = data.data.find((item) => item.id === pageId);
    return pagina?.access_token ?? null;
  }

  async suscribirPaginaLeadgen(pageId: string, pageAccessToken: string): Promise<void> {
    await this.post(`/${pageId}/subscribed_apps`, {
      subscribed_fields: 'leadgen',
      access_token: pageAccessToken,
    });
  }

  async obtenerNombreRecurso(metaId: string, accessToken: string): Promise<string | null> {
    const data = await this.get<{ name?: string }>(`/${metaId}`, {
      fields: 'name',
      access_token: accessToken,
    });
    return data.name ?? null;
  }

  async listarCuentasPublicitarias(accessToken: string): Promise<MetaCuentaPublicitaria[]> {
    const data = await this.get<GraphListResponse<{ id: string; name: string }>>('/me/adaccounts', {
      fields: 'id,name',
      access_token: accessToken,
    });
    return data.data.map((cuenta) => ({ id: cuenta.id, nombre: cuenta.name }));
  }

  async obtenerLead(leadgenId: string, accessToken: string): Promise<MetaLeadGraph> {
    const data = await this.get<{
      id: string;
      form_id?: string;
      ad_id?: string;
      adset_id?: string;
      campaign_id?: string;
      created_time?: string;
      field_data?: { name: string; values: string[] }[];
    }>(`/${leadgenId}`, {
      fields: 'field_data,ad_id,adset_id,campaign_id,form_id,created_time',
      access_token: accessToken,
    });

    return {
      leadgenId: data.id,
      formId: data.form_id,
      adId: data.ad_id,
      adsetId: data.adset_id,
      campaignId: data.campaign_id,
      createdTime: data.created_time ? new Date(data.created_time) : undefined,
      fieldData: (data.field_data ?? []).map((f) => ({ name: f.name, values: f.values })),
      raw: data,
    };
  }

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.http.get<T>(`${GRAPH_BASE_URL}${path}`, { params }),
      );
      return response.data;
    } catch (error) {
      const mensaje =
        error instanceof AxiosError
          ? ((error.response?.data as { error?: { message?: string } })?.error?.message ??
            error.message)
          : 'Error desconocido al llamar a Meta Graph API';
      throw new BadGatewayException(`Meta Graph API: ${mensaje}`);
    }
  }

  private async post(path: string, params: Record<string, string>): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${GRAPH_BASE_URL}${path}`, null, { params }));
    } catch (error) {
      const mensaje =
        error instanceof AxiosError
          ? ((error.response?.data as { error?: { message?: string } })?.error?.message ??
            error.message)
          : 'Error desconocido al llamar a Meta Graph API';
      throw new BadGatewayException(`Meta Graph API: ${mensaje}`);
    }
  }
}
