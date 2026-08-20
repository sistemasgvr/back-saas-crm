import { BadGatewayException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { obtenerVersionGraph } from '../../../shared/infrastructure/meta-graph-version';
import type {
  AppSuscritaGraph,
  FiltroLeadsDeForm,
  MetaAnuncioGraph,
  MetaCampanaGraph,
  MetaConjuntoAnuncioGraph,
  MetaCuentaPublicitariaDetalleGraph,
  MetaCuentaPublicitariaGraph,
  MetaFormularioGraph,
  MetaGraphClient,
  MetaLeadGraph,
  MetaPaginaGraph,
  MetaUsuario,
  PaginaLeadsDeForm,
  TokenIntercambiado,
} from '../application/ports/meta-graph-client.port';

// https://developers.facebook.com/docs/marketing-api/reference/ad-account#fields (account_status)
const ESTADOS_CUENTA: Record<number, string> = {
  1: 'ACTIVE',
  2: 'DISABLED',
  3: 'UNSETTLED',
  7: 'PENDING_RISK_REVIEW',
  8: 'PENDING_SETTLEMENT',
  9: 'IN_GRACE_PERIOD',
  100: 'PENDING_CLOSURE',
  101: 'CLOSED',
};

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
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private get graphBaseUrl(): string {
    return `https://graph.facebook.com/${obtenerVersionGraph(this.config)}`;
  }

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
    return {
      accessToken: data.access_token,
      expiraEnSegundos: data.expires_in,
    };
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
    return {
      accessToken: data.access_token,
      expiraEnSegundos: data.expires_in,
    };
  }

  async obtenerUsuario(accessToken: string): Promise<MetaUsuario> {
    const data = await this.get<{ id: string; name: string }>('/me', {
      fields: 'id,name',
      access_token: accessToken,
    });
    return { id: data.id, nombre: data.name };
  }

  async listarPaginas(accessToken: string): Promise<MetaPaginaGraph[]> {
    const data = await this.get<
      GraphListResponse<{ id: string; name: string }>
    >('/me/accounts', {
      fields: 'id,name',
      access_token: accessToken,
    });
    return data.data.map((pagina) => ({ id: pagina.id, nombre: pagina.name }));
  }

  async obtenerAccessTokenPagina(
    pageId: string,
    userAccessToken: string,
  ): Promise<string | null> {
    const data = await this.get<
      GraphListResponse<{ id: string; access_token?: string }>
    >('/me/accounts', {
      fields: 'id,access_token',
      access_token: userAccessToken,
    });
    const pagina = data.data.find((item) => item.id === pageId);
    return pagina?.access_token ?? null;
  }

  async suscribirPaginaLeadgen(
    pageId: string,
    pageAccessToken: string,
  ): Promise<void> {
    await this.post(`/${pageId}/subscribed_apps`, {
      subscribed_fields: 'leadgen',
      access_token: pageAccessToken,
    });
  }

  async desuscribirPaginaLeadgen(
    pageId: string,
    pageAccessToken: string,
  ): Promise<void> {
    await this.delete(`/${pageId}/subscribed_apps`, {
      access_token: pageAccessToken,
    });
  }

  async obtenerNombreRecurso(
    metaId: string,
    accessToken: string,
  ): Promise<string | null> {
    const data = await this.get<{ name?: string }>(`/${metaId}`, {
      fields: 'name',
      access_token: accessToken,
    });
    return data.name ?? null;
  }

  async listarCuentasPublicitarias(
    accessToken: string,
  ): Promise<MetaCuentaPublicitariaGraph[]> {
    const data = await this.get<
      GraphListResponse<{ id: string; name: string }>
    >('/me/adaccounts', {
      fields: 'id,name',
      access_token: accessToken,
    });
    return data.data.map((cuenta) => ({ id: cuenta.id, nombre: cuenta.name }));
  }

  async obtenerCuentaPublicitaria(
    adAccountId: string,
    accessToken: string,
  ): Promise<MetaCuentaPublicitariaDetalleGraph | null> {
    const data = await this.get<{
      id: string;
      name?: string;
      currency?: string;
      account_status?: number;
      timezone_name?: string;
    }>(`/${adAccountId}`, {
      fields: 'name,currency,account_status,timezone_name',
      access_token: accessToken,
    });
    if (!data.id) return null;
    return {
      id: data.id,
      nombre: data.name ?? adAccountId,
      moneda: data.currency,
      estadoCuenta: data.account_status
        ? (ESTADOS_CUENTA[data.account_status] ?? String(data.account_status))
        : undefined,
      timezone: data.timezone_name,
    };
  }

  async obtenerLead(
    leadgenId: string,
    accessToken: string,
  ): Promise<MetaLeadGraph> {
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
      fieldData: (data.field_data ?? []).map((f) => ({
        name: f.name,
        values: f.values,
      })),
      raw: data,
    };
  }

  async listarCampanasDeCuenta(
    adAccountId: string,
    accessToken: string,
  ): Promise<MetaCampanaGraph[]> {
    const data = await this.get<
      GraphListResponse<{ id: string; name: string; status?: string }>
    >(`/${adAccountId}/campaigns`, {
      fields: 'id,name,status',
      access_token: accessToken,
      limit: '200',
    });
    return data.data.map((c) => ({
      id: c.id,
      nombre: c.name,
      estado: c.status,
    }));
  }

  async listarConjuntosDeCampana(
    campanaId: string,
    accessToken: string,
  ): Promise<MetaConjuntoAnuncioGraph[]> {
    const data = await this.get<
      GraphListResponse<{ id: string; name: string; status?: string }>
    >(`/${campanaId}/adsets`, {
      fields: 'id,name,status',
      access_token: accessToken,
      limit: '200',
    });
    return data.data.map((c) => ({
      id: c.id,
      nombre: c.name,
      campanaId,
      estado: c.status,
    }));
  }

  async listarAnunciosDeConjunto(
    conjuntoId: string,
    accessToken: string,
  ): Promise<MetaAnuncioGraph[]> {
    const data = await this.get<
      GraphListResponse<{ id: string; name: string; status?: string }>
    >(`/${conjuntoId}/ads`, {
      fields: 'id,name,status',
      access_token: accessToken,
      limit: '200',
    });
    return data.data.map((a) => ({
      id: a.id,
      nombre: a.name,
      conjuntoAnuncioId: conjuntoId,
      estado: a.status,
    }));
  }

  async listarLeadgenForms(
    pageId: string,
    pageAccessToken: string,
  ): Promise<MetaFormularioGraph[]> {
    const data = await this.get<
      GraphListResponse<{
        id: string;
        name: string;
        status?: string;
        locale?: string;
      }>
    >(`/${pageId}/leadgen_forms`, {
      fields: 'id,name,status,locale',
      access_token: pageAccessToken,
      limit: '200',
    });
    return data.data.map((form) => ({
      id: form.id,
      nombre: form.name,
      estado: form.status,
      locale: form.locale,
    }));
  }

  async listarLeadsDeForm(
    formId: string,
    pageAccessToken: string,
    filtro: FiltroLeadsDeForm,
  ): Promise<PaginaLeadsDeForm> {
    const filtering: { field: string; operator: string; value: number }[] = [];
    if (filtro.desde) {
      filtering.push({
        field: 'time_created',
        operator: 'GREATER_THAN',
        value: Math.floor(filtro.desde.getTime() / 1000),
      });
    }
    if (filtro.hasta) {
      filtering.push({
        field: 'time_created',
        operator: 'LESS_THAN',
        value: Math.floor(filtro.hasta.getTime() / 1000),
      });
    }

    const params: Record<string, string> = {
      fields: 'id,form_id,ad_id,adset_id,campaign_id,created_time,field_data',
      access_token: pageAccessToken,
      limit: String(filtro.limit ?? 50),
    };
    if (filtering.length > 0) params.filtering = JSON.stringify(filtering);
    if (filtro.despues) params.after = filtro.despues;

    const data = await this.get<{
      data: {
        id: string;
        form_id?: string;
        ad_id?: string;
        adset_id?: string;
        campaign_id?: string;
        created_time?: string;
        field_data?: { name: string; values: string[] }[];
      }[];
      paging?: { cursors?: { after?: string }; next?: string };
    }>(`/${formId}/leads`, params);

    return {
      leads: data.data.map((item) => ({
        leadgenId: item.id,
        formId: item.form_id,
        adId: item.ad_id,
        adsetId: item.adset_id,
        campaignId: item.campaign_id,
        createdTime: item.created_time
          ? new Date(item.created_time)
          : undefined,
        fieldData: (item.field_data ?? []).map((f) => ({
          name: f.name,
          values: f.values,
        })),
        raw: item,
      })),
      siguienteCursor: data.paging?.next
        ? data.paging.cursors?.after
        : undefined,
    };
  }

  async obtenerAppsSuscritas(
    pageId: string,
    pageAccessToken: string,
  ): Promise<AppSuscritaGraph[]> {
    const data = await this.get<
      GraphListResponse<{ id: string; subscribed_fields?: string[] }>
    >(`/${pageId}/subscribed_apps`, {
      access_token: pageAccessToken,
    });
    return data.data.map((app) => ({
      id: app.id,
      camposSuscritos: app.subscribed_fields ?? [],
    }));
  }

  private async get<T>(
    path: string,
    params: Record<string, string>,
  ): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.http.get<T>(`${this.graphBaseUrl}${path}`, { params }),
      );
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 429) {
        // Backoff simple ante rate limit (PLAN-FASE-14 §4.3) — un solo reintento.
        await new Promise((resolve) => setTimeout(resolve, 1500));
        try {
          const retry = await firstValueFrom(
            this.http.get<T>(`${this.graphBaseUrl}${path}`, { params }),
          );
          return retry.data;
        } catch (retryError) {
          throw new BadGatewayException(
            `Meta Graph API: ${this.mensajeError(retryError)}`,
          );
        }
      }
      throw new BadGatewayException(
        `Meta Graph API: ${this.mensajeError(error)}`,
      );
    }
  }

  private async post(
    path: string,
    params: Record<string, string>,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.graphBaseUrl}${path}`, null, { params }),
      );
    } catch (error) {
      throw new BadGatewayException(
        `Meta Graph API: ${this.mensajeError(error)}`,
      );
    }
  }

  private async delete(
    path: string,
    params: Record<string, string>,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.graphBaseUrl}${path}`, { params }),
      );
    } catch (error) {
      throw new BadGatewayException(
        `Meta Graph API: ${this.mensajeError(error)}`,
      );
    }
  }

  private mensajeError(error: unknown): string {
    return error instanceof AxiosError
      ? ((error.response?.data as { error?: { message?: string } })?.error
          ?.message ?? error.message)
      : 'Error desconocido al llamar a Meta Graph API';
  }
}
