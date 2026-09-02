import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import FormData from 'form-data';
import { obtenerVersionGraph } from '../../../shared/infrastructure/meta-graph-version';
import {
  esRateLimitMeta,
  excepcionDesdeErrorMeta,
} from '../application/mapear-error-meta-graph';
import type {
  AppSuscritaGraph,
  CrearPlantillaWhatsAppInput,
  DebugTokenGraph,
  FiltroInsights,
  FiltroLeadsDeForm,
  ListadoGraph,
  MetaAnuncioGraph,
  MetaCampanaGraph,
  MetaConjuntoAnuncioGraph,
  MetaCuentaPublicitariaDetalleGraph,
  MetaCuentaPublicitariaGraph,
  MetaFormularioGraph,
  MetaGraphClient,
  MetaInsightGraph,
  MetaLeadGraph,
  MetaMediaDescargadoGraph,
  MetaMediaSubidoGraph,
  MetaMensajeWhatsAppEnviado,
  MetaNumeroWhatsAppGraph,
  MetaPaginaGraph,
  MetaPlantillaWhatsAppGraph,
  MetaUsuario,
  PaginaLeadsDeForm,
  ParametroPlantilla,
  TipoMediaWhatsApp,
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

/** Tope de seguridad para evitar bucles infinitos si Meta no deja de devolver `paging.next`. */
const MAX_PAGINAS_GRAPH = 100;

interface GraphTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

interface GraphListResponse<T> {
  data: T[];
  paging?: {
    cursors?: { after?: string; before?: string };
    next?: string;
  };
}

@Injectable()
export class AxiosMetaGraphClient implements MetaGraphClient {
  private readonly logger = new Logger(AxiosMetaGraphClient.name);

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
    const { data: pages } = await this.getAllPages<{
      id: string;
      name: string;
    }>('/me/accounts', {
      fields: 'id,name',
      access_token: accessToken,
      limit: '100',
    });
    return pages.map((pagina) => ({ id: pagina.id, nombre: pagina.name }));
  }

  async obtenerAccessTokenPagina(
    pageId: string,
    userAccessToken: string,
  ): Promise<string | null> {
    // Página hasta encontrar pageId (crítico para backfill): no acumula todo.
    const params: Record<string, string> = {
      fields: 'id,access_token',
      access_token: userAccessToken,
      limit: '100',
    };
    let after: string | undefined;
    for (let pagina = 0; pagina < MAX_PAGINAS_GRAPH; pagina += 1) {
      const pageParams = after ? { ...params, after } : params;
      const data = await this.get<
        GraphListResponse<{ id: string; access_token?: string }>
      >('/me/accounts', pageParams);
      const encontrada = data.data.find((item) => item.id === pageId);
      if (encontrada) return encontrada.access_token ?? null;
      if (!data.paging?.next || !data.paging.cursors?.after) return null;
      after = data.paging.cursors.after;
    }
    this.logger.warn(
      `obtenerAccessTokenPagina: se alcanzó el tope de ${MAX_PAGINAS_GRAPH} páginas sin hallar pageId=${pageId}`,
    );
    return null;
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

  async obtenerNombresRecursos(
    metaIds: string[],
    accessToken: string,
  ): Promise<Map<string, string | null>> {
    const resultado = new Map<string, string | null>();
    const idsUnicos = [...new Set(metaIds)];
    if (idsUnicos.length === 0) return resultado;

    // Graph v26+ rechaza GET /?ids=... (legacy). Usar Batch API (máx 50 ops)
    // para resolver nombres en una sola HTTP round-trip por lote.
    const TAMANO_LOTE = 50;
    for (let i = 0; i < idsUnicos.length; i += TAMANO_LOTE) {
      const lote = idsUnicos.slice(i, i + TAMANO_LOTE);
      const nombres = await this.obtenerNombresViaBatch(lote, accessToken);
      for (const id of lote) {
        resultado.set(id, nombres.get(id) ?? null);
      }
    }
    return resultado;
  }

  /**
   * Fallback por id: GET /{id}?fields=name (sin `ids=`) para no bloquear
   * el backfill cuando el batch falla o Meta responde error de lote.
   */
  private async resolverNombresPorId(
    ids: string[],
    accessToken: string,
  ): Promise<Map<string, string | null>> {
    const resultado = new Map<string, string | null>();
    for (const id of ids) {
      try {
        resultado.set(id, await this.obtenerNombreRecurso(id, accessToken));
      } catch {
        resultado.set(id, null);
      }
    }
    return resultado;
  }

  /**
   * POST / con body `batch=[...]` — alternativa soportada a `GET /?ids=`
   * (deprecado en Graph v26.0+). Form-urlencoded según docs de Meta Batch.
   * Si un id individual falla, queda null sin tumbar el lote entero.
   */
  private async obtenerNombresViaBatch(
    ids: string[],
    accessToken: string,
  ): Promise<Map<string, string | null>> {
    const resultado = new Map<string, string | null>();
    const batch = ids.map((id) => ({
      method: 'GET',
      relative_url: `${id}?fields=name`,
    }));

    try {
      const body = new URLSearchParams({
        access_token: accessToken,
        include_headers: 'false',
        batch: JSON.stringify(batch),
      });

      // Mismo criterio que get(): Meta suele meter rate limit en el body, no 429.
      const ESPERAS_RATE_LIMIT_MS = [1500, 4000];
      let data: { code?: number; body?: string }[] | { error?: unknown };
      for (let intento = 0; ; intento += 1) {
        try {
          const responses = await firstValueFrom(
            this.http.post<
              { code?: number; body?: string }[] | { error?: unknown }
            >(`${this.graphBaseUrl}/`, body.toString(), {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            }),
          );
          data = responses.data;
          break;
        } catch (error) {
          const espera = ESPERAS_RATE_LIMIT_MS[intento];
          if (espera && esRateLimitMeta(error)) {
            await new Promise((resolve) => setTimeout(resolve, espera));
            continue;
          }
          throw excepcionDesdeErrorMeta(error);
        }
      }

      // Respuesta no-array (incluye `{ error: ... }` de Meta): fallback por id.
      if (!Array.isArray(data)) {
        this.logger.warn(
          `Batch de nombres Graph devolvió error/no-array; se reintenta por id (${ids.length})`,
        );
        return this.resolverNombresPorId(ids, accessToken);
      }

      for (let i = 0; i < ids.length; i += 1) {
        const item = data[i];
        if (!item || item.code !== 200 || !item.body) {
          resultado.set(ids[i], null);
          continue;
        }
        try {
          const parsed = JSON.parse(item.body) as {
            name?: string;
            error?: unknown;
          };
          resultado.set(ids[i], parsed.error ? null : (parsed.name ?? null));
        } catch {
          resultado.set(ids[i], null);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Batch de nombres Graph falló; se reintenta por id (${ids.length})`,
        error instanceof Error ? error.message : error,
      );
      return this.resolverNombresPorId(ids, accessToken);
    }

    return resultado;
  }

  async listarCuentasPublicitarias(
    accessToken: string,
  ): Promise<MetaCuentaPublicitariaGraph[]> {
    const { data: cuentas } = await this.getAllPages<{
      id: string;
      name: string;
    }>('/me/adaccounts', {
      fields: 'id,name',
      access_token: accessToken,
      limit: '100',
    });
    return cuentas.map((cuenta) => ({ id: cuenta.id, nombre: cuenta.name }));
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
  ): Promise<ListadoGraph<MetaCampanaGraph>> {
    const { data: campanas, truncado } = await this.getAllPages<{
      id: string;
      name: string;
      status?: string;
    }>(`/${adAccountId}/campaigns`, {
      fields: 'id,name,status',
      access_token: accessToken,
      limit: '200',
    });
    return {
      items: campanas.map((c) => ({
        id: c.id,
        nombre: c.name,
        estado: c.status,
      })),
      truncado,
    };
  }

  async listarConjuntosDeCampana(
    campanaId: string,
    accessToken: string,
  ): Promise<ListadoGraph<MetaConjuntoAnuncioGraph>> {
    const { data: conjuntos, truncado } = await this.getAllPages<{
      id: string;
      name: string;
      status?: string;
    }>(`/${campanaId}/adsets`, {
      fields: 'id,name,status',
      access_token: accessToken,
      limit: '200',
    });
    return {
      items: conjuntos.map((c) => ({
        id: c.id,
        nombre: c.name,
        campanaId,
        estado: c.status,
      })),
      truncado,
    };
  }

  async listarAnunciosDeConjunto(
    conjuntoId: string,
    accessToken: string,
  ): Promise<ListadoGraph<MetaAnuncioGraph>> {
    const { data: anuncios, truncado } = await this.getAllPages<{
      id: string;
      name: string;
      status?: string;
    }>(`/${conjuntoId}/ads`, {
      fields: 'id,name,status',
      access_token: accessToken,
      limit: '200',
    });
    return {
      items: anuncios.map((a) => ({
        id: a.id,
        nombre: a.name,
        conjuntoAnuncioId: conjuntoId,
        estado: a.status,
      })),
      truncado,
    };
  }

  async listarLeadgenForms(
    pageId: string,
    pageAccessToken: string,
  ): Promise<MetaFormularioGraph[]> {
    const { data: forms } = await this.getAllPages<{
      id: string;
      name: string;
      status?: string;
      locale?: string;
    }>(`/${pageId}/leadgen_forms`, {
      fields: 'id,name,status,locale',
      access_token: pageAccessToken,
      limit: '200',
    });
    return forms.map((form) => ({
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

  async contarLeadsDeForm(
    formId: string,
    pageAccessToken: string,
  ): Promise<number> {
    // Campo propio del objeto Lead Gen Form — no hace falta listar leads.
    const data = await this.get<{ leads_count?: number }>(`/${formId}`, {
      fields: 'leads_count',
      access_token: pageAccessToken,
    });
    return data.leads_count ?? 0;
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

  async obtenerInsights(
    adAccountId: string,
    accessToken: string,
    filtro: FiltroInsights,
  ): Promise<MetaInsightGraph[]> {
    const camposComunes =
      'spend,impressions,clicks,ctr,cpc,reach,account_currency,date_start';
    const fields =
      filtro.nivel === 'campaign'
        ? `campaign_id,campaign_name,${camposComunes}`
        : camposComunes;

    const { data: items } = await this.getAllPages<{
      date_start: string;
      spend?: string;
      impressions?: string;
      clicks?: string;
      ctr?: string;
      cpc?: string;
      reach?: string;
      account_currency?: string;
      campaign_id?: string;
      campaign_name?: string;
    }>(`/${adAccountId}/insights`, {
      fields,
      time_range: JSON.stringify({ since: filtro.desde, until: filtro.hasta }),
      time_increment: '1',
      level: filtro.nivel,
      access_token: accessToken,
      limit: '500',
    });

    return items.map((item) => ({
      fecha: item.date_start,
      spend: Number(item.spend ?? 0),
      impressions: Number(item.impressions ?? 0),
      clicks: Number(item.clicks ?? 0),
      ctr: item.ctr !== undefined ? Number(item.ctr) : undefined,
      cpc: item.cpc !== undefined ? Number(item.cpc) : undefined,
      reach: item.reach !== undefined ? Number(item.reach) : undefined,
      moneda: item.account_currency,
      campanaMetaId: item.campaign_id,
      campanaNombre: item.campaign_name,
    }));
  }

  async debugToken(
    inputToken: string,
    appId: string,
    appSecret: string,
  ): Promise<DebugTokenGraph> {
    const data = await this.get<{
      data: { is_valid?: boolean; scopes?: string[]; expires_at?: number };
    }>('/debug_token', {
      input_token: inputToken,
      access_token: `${appId}|${appSecret}`,
    });
    return {
      isValid: data.data.is_valid ?? false,
      scopes: data.data.scopes ?? [],
      expiresAt: data.data.expires_at
        ? new Date(data.data.expires_at * 1000)
        : undefined,
    };
  }

  async revocarPermiso(
    metaUserId: string,
    permiso: string,
    accessToken: string,
  ): Promise<void> {
    await this.delete(`/${metaUserId}/permissions/${permiso}`, {
      access_token: accessToken,
    });
  }

  // --- WhatsApp Cloud API / Business Management (Fase G3) ---

  async listarNumerosWhatsApp(
    accessToken: string,
  ): Promise<MetaNumeroWhatsAppGraph[]> {
    const data = await this.get<{
      data: {
        id: string;
        name: string;
        owned_whatsapp_business_accounts?: {
          data: {
            id: string;
            name: string;
            phone_numbers?: {
              data: {
                id: string;
                display_phone_number: string;
                verified_name: string;
                code_verification_status?: string;
                quality_rating?: string;
              }[];
            };
          }[];
        };
      }[];
    }>('/me/businesses', {
      fields:
        'name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name,code_verification_status,quality_rating}}',
      access_token: accessToken,
    });

    const numeros: MetaNumeroWhatsAppGraph[] = [];
    for (const negocio of data.data) {
      for (const waba of negocio.owned_whatsapp_business_accounts?.data ?? []) {
        for (const numero of waba.phone_numbers?.data ?? []) {
          numeros.push({
            wabaId: waba.id,
            wabaNombre: waba.name,
            phoneNumberId: numero.id,
            displayPhoneNumber: numero.display_phone_number,
            verifiedName: numero.verified_name,
            codeVerificationStatus: numero.code_verification_status,
            qualityRating: numero.quality_rating,
          });
        }
      }
    }
    return numeros;
  }

  async suscribirWabaWebhook(
    wabaId: string,
    accessToken: string,
  ): Promise<void> {
    await this.post(`/${wabaId}/subscribed_apps`, {
      access_token: accessToken,
    });
  }

  async desuscribirWabaWebhook(
    wabaId: string,
    accessToken: string,
  ): Promise<void> {
    await this.delete(`/${wabaId}/subscribed_apps`, {
      access_token: accessToken,
    });
  }

  async obtenerAppsSuscritasWaba(
    wabaId: string,
    accessToken: string,
  ): Promise<AppSuscritaGraph[]> {
    const data = await this.get<
      GraphListResponse<{ id: string; subscribed_fields?: string[] }>
    >(`/${wabaId}/subscribed_apps`, { access_token: accessToken });
    return data.data.map((app) => ({
      id: app.id,
      camposSuscritos: app.subscribed_fields ?? [],
    }));
  }

  async listarPlantillasWhatsApp(
    wabaId: string,
    accessToken: string,
  ): Promise<MetaPlantillaWhatsAppGraph[]> {
    const { data } = await this.getAllPages<{
      name: string;
      language: string;
      category: string;
      status: string;
      parameter_format?: string;
      components?: { type: string; text?: string }[];
    }>(`/${wabaId}/message_templates`, {
      fields: 'name,language,category,status,parameter_format,components',
      access_token: accessToken,
      limit: '100',
    });
    return data.map((t) => ({
      nombre: t.name,
      idioma: t.language,
      categoria: t.category,
      estado: t.status,
      cuerpoTexto: t.components?.find((c) => c.type === 'BODY')?.text,
      encabezadoTexto: t.components?.find((c) => c.type === 'HEADER')?.text,
      // Meta usa 'positional' por defecto cuando el creador no especificó
      // formato — mismo default documentado, para plantillas legacy sin el campo.
      formatoParametros: t.parameter_format ?? 'POSITIONAL',
    }));
  }

  async crearPlantillaWhatsApp(
    wabaId: string,
    accessToken: string,
    input: CrearPlantillaWhatsAppInput,
  ): Promise<void> {
    const components: Record<string, unknown>[] = [];
    if (input.encabezado) {
      components.push({
        type: 'HEADER',
        format: 'TEXT',
        text: input.encabezado,
        ...(input.variableEncabezado
          ? {
              example: {
                header_text_named_params: [
                  {
                    param_name: input.variableEncabezado.nombre,
                    example: input.variableEncabezado.ejemplo,
                  },
                ],
              },
            }
          : {}),
      });
    }
    components.push({
      type: 'BODY',
      text: input.cuerpo,
      ...(input.variablesCuerpo?.length
        ? {
            example: {
              body_text_named_params: input.variablesCuerpo.map((v) => ({
                param_name: v.nombre,
                example: v.ejemplo,
              })),
            },
          }
        : {}),
    });
    if (input.pie) {
      components.push({ type: 'FOOTER', text: input.pie });
    }

    await this.postJson(
      `/${wabaId}/message_templates`,
      {
        name: input.nombre,
        category: input.categoria,
        language: input.idioma,
        // Siempre "named" — es lo único que ofrece la creación de plantillas
        // de este CRM (WhatsApp Business Platform docs, vigente en v26).
        parameter_format: 'named',
        components,
      },
      accessToken,
    );
  }

  async enviarMensajeTextoWhatsApp(
    phoneNumberId: string,
    accessToken: string,
    para: string,
    texto: string,
  ): Promise<MetaMensajeWhatsAppEnviado> {
    const data = await this.postJson<{ messages: { id: string }[] }>(
      `/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: para,
        type: 'text',
        text: { body: texto },
      },
      accessToken,
    );
    return { wamid: data.messages[0].id };
  }

  async enviarReaccionWhatsApp(
    phoneNumberId: string,
    accessToken: string,
    para: string,
    wamidObjetivo: string,
    emoji: string,
  ): Promise<void> {
    await this.postJson(
      `/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: para,
        type: 'reaction',
        reaction: { message_id: wamidObjetivo, emoji },
      },
      accessToken,
    );
  }

  async enviarMensajePlantillaWhatsApp(
    phoneNumberId: string,
    accessToken: string,
    para: string,
    nombrePlantilla: string,
    idioma: string,
    parametros?: ParametroPlantilla[],
    formatoParametros?: string,
  ): Promise<MetaMensajeWhatsAppEnviado> {
    // 'NAMED' (default, lo único que crea este CRM) manda parameter_name por
    // cada valor; 'POSITIONAL' (plantillas legacy creadas fuera del CRM) los
    // manda en orden, sin nombre — Meta rechaza el mensaje si no coincide
    // con el parameter_format real de la plantilla aprobada.
    const esPosicional = formatoParametros === 'POSITIONAL';
    const data = await this.postJson<{ messages: { id: string }[] }>(
      `/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: para,
        type: 'template',
        template: {
          name: nombrePlantilla,
          language: { code: idioma },
          ...(parametros?.length
            ? {
                components: [
                  {
                    type: 'body',
                    parameters: parametros.map((p) => ({
                      type: 'text',
                      ...(esPosicional ? {} : { parameter_name: p.nombre }),
                      text: p.valor,
                    })),
                  },
                ],
              }
            : {}),
        },
      },
      accessToken,
    );
    return { wamid: data.messages[0].id };
  }

  async enviarEventoConversionLead(
    datasetId: string,
    accessToken: string,
    evento: {
      nombreEvento: string;
      fechaEvento: Date;
      eventoId: string;
      leadIdMeta: string;
    },
  ): Promise<void> {
    // action_source: 'system_generated' — el evento lo dispara un cambio de
    // estado en el CRM, sin sesión de navegador de por medio (a diferencia
    // del evento inicial "Lead", que sí viene con sesión/pixel).
    await this.postJson(
      `/${datasetId}/events`,
      {
        data: [
          {
            event_name: evento.nombreEvento,
            event_time: Math.floor(evento.fechaEvento.getTime() / 1000),
            event_id: evento.eventoId,
            action_source: 'system_generated',
            lead_event_source: 'SAAS CRM',
            user_data: { lead_id: evento.leadIdMeta },
          },
        ],
      },
      accessToken,
    );
  }

  async subirMediaWhatsApp(
    phoneNumberId: string,
    accessToken: string,
    buffer: Buffer,
    mimeType: string,
    nombreArchivo?: string,
  ): Promise<MetaMediaSubidoGraph> {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mimeType);
    form.append('file', buffer, {
      filename: nombreArchivo ?? 'archivo',
      contentType: mimeType,
    });
    try {
      const response = await firstValueFrom(
        this.http.post<{ id: string }>(
          `${this.graphBaseUrl}/${phoneNumberId}/media`,
          form,
          {
            params: { access_token: accessToken },
            headers: form.getHeaders(),
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
          },
        ),
      );
      return { mediaId: response.data.id };
    } catch (error) {
      throw excepcionDesdeErrorMeta(error);
    }
  }

  async descargarMediaWhatsApp(
    mediaId: string,
    accessToken: string,
  ): Promise<MetaMediaDescargadoGraph> {
    try {
      // Paso 1: resolver la URL firmada (dura 5 minutos).
      const resuelto = await firstValueFrom(
        this.http.get<{ url: string; mime_type: string }>(
          `${this.graphBaseUrl}/${mediaId}`,
          { params: { access_token: accessToken } },
        ),
      );
      // Paso 2: descargar los bytes de esa URL — Meta exige el MISMO access
      // token, como Bearer, o la descarga falla ("If you omit your token,
      // the request will fail").
      const descarga = await firstValueFrom(
        this.http.get<ArrayBuffer>(resuelto.data.url, {
          headers: { Authorization: `Bearer ${accessToken}` },
          responseType: 'arraybuffer',
        }),
      );
      return {
        buffer: Buffer.from(descarga.data),
        mimeType: resuelto.data.mime_type,
      };
    } catch (error) {
      throw excepcionDesdeErrorMeta(error);
    }
  }

  async enviarMediaWhatsApp(
    phoneNumberId: string,
    accessToken: string,
    para: string,
    tipo: TipoMediaWhatsApp,
    mediaId: string,
    opciones?: { caption?: string; filename?: string },
  ): Promise<MetaMensajeWhatsAppEnviado> {
    // Meta no admite caption en audio/sticker, y filename solo en document.
    const objetoMedia: Record<string, unknown> = { id: mediaId };
    if (opciones?.caption && tipo !== 'audio' && tipo !== 'sticker') {
      objetoMedia.caption = opciones.caption;
    }
    if (opciones?.filename && tipo === 'document') {
      objetoMedia.filename = opciones.filename;
    }

    const data = await this.postJson<{ messages: { id: string }[] }>(
      `/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: para,
        type: tipo,
        [tipo]: objetoMedia,
      },
      accessToken,
    );
    return { wamid: data.messages[0].id };
  }

  /**
   * Acumula todas las páginas de un edge Graph siguiendo `paging.cursors.after`
   * mientras exista `paging.next` (mismo criterio que `listarLeadsDeForm`).
   * `truncado=true` si se cortó por MAX_PAGINAS_GRAPH con más páginas pendientes.
   */
  private async getAllPages<T>(
    path: string,
    params: Record<string, string>,
  ): Promise<{ data: T[]; truncado: boolean }> {
    const acumulado: T[] = [];
    let after: string | undefined;

    for (let pagina = 0; pagina < MAX_PAGINAS_GRAPH; pagina += 1) {
      const pageParams = after ? { ...params, after } : params;
      const data = await this.get<GraphListResponse<T>>(path, pageParams);
      acumulado.push(...(data.data ?? []));

      if (!data.paging?.next || !data.paging.cursors?.after) {
        return { data: acumulado, truncado: false };
      }
      after = data.paging.cursors.after;
    }

    this.logger.warn(
      `getAllPages: resultado POSIBLEMENTE TRUNCADO — tope de ${MAX_PAGINAS_GRAPH} páginas alcanzado en ${path} (items=${acumulado.length}); puede haber más datos en Graph`,
    );
    return { data: acumulado, truncado: true };
  }

  private async get<T>(
    path: string,
    params: Record<string, string>,
  ): Promise<T> {
    // Meta casi nunca devuelve HTTP 429 real ante rate limit — el código va
    // en el body (ver esRateLimitMeta), así que el reintento se decide por eso.
    const ESPERAS_RATE_LIMIT_MS = [1500, 4000];
    for (let intento = 0; ; intento += 1) {
      try {
        const response = await firstValueFrom(
          this.http.get<T>(`${this.graphBaseUrl}${path}`, { params }),
        );
        return response.data;
      } catch (error) {
        const espera = ESPERAS_RATE_LIMIT_MS[intento];
        if (espera && esRateLimitMeta(error)) {
          await new Promise((resolve) => setTimeout(resolve, espera));
          continue;
        }
        throw excepcionDesdeErrorMeta(error);
      }
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
      throw excepcionDesdeErrorMeta(error);
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
      throw excepcionDesdeErrorMeta(error);
    }
  }

  /** POST con body JSON real (a diferencia de `post()`, que solo manda
   * query params) — lo necesita el envío de mensajes de WhatsApp. */
  private async postJson<T>(
    path: string,
    body: unknown,
    accessToken: string,
  ): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.http.post<T>(`${this.graphBaseUrl}${path}`, body, {
          params: { access_token: accessToken },
        }),
      );
      return response.data;
    } catch (error) {
      throw excepcionDesdeErrorMeta(error);
    }
  }
}
