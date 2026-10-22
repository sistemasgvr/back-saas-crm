import type { ConfigService } from '@nestjs/config';
import { ObtenerUrlOAuthUseCase } from './obtener-url-oauth.use-case';
import { ObtenerSaludPermisosMetaUseCase } from './obtener-salud-permisos-meta.use-case';
import type { MetaConexionesRepository } from '../ports/meta-conexiones.repository.port';
import type { MetaGraphClient } from '../ports/meta-graph-client.port';
import type { MetaOAuthStateService } from '../ports/meta-oauth-state.port';
import type { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import {
  featuresDeseadasDe,
  featuresRequeridasPara,
  scopesDeFeatures,
} from '../meta-permisos-matriz';

/** Scopes que exigen las funcionalidades actuales (doc de permisos Graph v26). */
const SCOPES_LEAD_ADS_Y_PUBLICIDAD = [
  'pages_show_list',
  'pages_manage_metadata',
  'pages_read_engagement',
  'pages_manage_ads',
  'leads_retrieval',
  'ads_read',
  'ads_management',
  'business_management',
];
const SCOPES_WHATSAPP = [
  'whatsapp_business_management',
  'whatsapp_business_messaging',
];

function scopesDeUrl(url: string): string[] {
  return (new URL(url).searchParams.get('scope') ?? '').split(',').sort();
}

function fixture(modulos: string[], featuresDeseadas: unknown = null) {
  const conexiones = {
    findActivaPorOrganizacion: jest.fn().mockResolvedValue({
      appId: 'app-id',
      tokenCifrado: 'token',
      appSecretCifrado: 'secret',
      featuresDeseadas,
    }),
    listarModulosActivos: jest.fn().mockResolvedValue(modulos),
  };
  const config = {
    get: jest.fn().mockReturnValue(undefined),
    getOrThrow: jest.fn().mockReturnValue('https://api.test/meta/callback'),
  };
  const oauthState = { firmar: jest.fn().mockReturnValue('state-firmado') };
  const graph = {
    debugToken: jest.fn(),
  };
  const encryption = {
    decrypt: jest.fn().mockImplementation((value: string) => value),
  };
  const url = new ObtenerUrlOAuthUseCase(
    config as unknown as ConfigService,
    oauthState as unknown as MetaOAuthStateService,
    conexiones as unknown as MetaConexionesRepository,
  );
  const salud = new ObtenerSaludPermisosMetaUseCase(
    conexiones as unknown as MetaConexionesRepository,
    graph as unknown as MetaGraphClient,
    encryption as unknown as TokenEncryptionService,
  );
  return { url, salud, graph };
}

describe('Matriz de permisos Meta', () => {
  it('business_management es requerido (dependencia de leads_retrieval)', () => {
    const scopes = scopesDeFeatures(
      featuresRequeridasPara(new Set()).map((f) => f.id),
    );
    expect(scopes.sort()).toEqual([...SCOPES_LEAD_ADS_Y_PUBLICIDAD].sort());
  });

  it('WhatsApp solo se requiere con el módulo WHATSAPP activo', () => {
    const scopes = scopesDeFeatures(
      featuresRequeridasPara(new Set(['WHATSAPP'])).map((f) => f.id),
    );
    expect(scopes.sort()).toEqual(
      [...SCOPES_LEAD_ADS_Y_PUBLICIDAD, ...SCOPES_WHATSAPP].sort(),
    );
  });

  it('ignora ids persistidos desconocidos o que ya no son opt-in', () => {
    const ids = featuresDeseadasDe(
      ['instagram_basic', 'pages_business', 'no_existe'],
      new Set(),
    );
    expect(ids).toContain('instagram_basic');
    expect(ids).toContain('pages_business');
    expect(ids).not.toContain('no_existe');
  });
});

describe('Solicitar permisos (URL OAuth)', () => {
  it('pide todos los permisos requeridos, incluido WhatsApp, en un solo diálogo', async () => {
    const { url } = fixture(['META_LEADS', 'WHATSAPP']);
    const { url: oauthUrl } = await url.execute('org', 'user', true);

    expect(scopesDeUrl(oauthUrl)).toEqual(
      [...SCOPES_LEAD_ADS_Y_PUBLICIDAD, ...SCOPES_WHATSAPP].sort(),
    );
    const params = new URL(oauthUrl).searchParams;
    expect(params.get('auth_type')).toBe('rerequest');
    expect(params.get('client_id')).toBe('app-id');
    expect(oauthUrl).toContain('https://www.facebook.com/v26.0/dialog/oauth');
  });

  it('no pide WhatsApp si la org no tiene el módulo', async () => {
    const { url } = fixture(['META_LEADS']);
    const { url: oauthUrl } = await url.execute('org', 'user');

    expect(scopesDeUrl(oauthUrl)).toEqual(
      [...SCOPES_LEAD_ADS_Y_PUBLICIDAD].sort(),
    );
  });

  it('suma los opt-in marcados y los pedidos puntualmente a los requeridos', async () => {
    const { url } = fixture(['META_LEADS'], ['pages_messaging']);
    const { url: oauthUrl } = await url.execute('org', 'user', true, [
      'instagram_basic',
    ]);

    expect(scopesDeUrl(oauthUrl)).toEqual(
      [
        ...SCOPES_LEAD_ADS_Y_PUBLICIDAD,
        'pages_messaging',
        'instagram_basic',
      ].sort(),
    );
  });
});

describe('Salud de permisos', () => {
  it('reporta los requeridos faltantes contra debug_token', async () => {
    const { salud, graph } = fixture(['META_LEADS', 'WHATSAPP']);
    graph.debugToken.mockResolvedValue({
      isValid: true,
      scopes: SCOPES_LEAD_ADS_Y_PUBLICIDAD.filter(
        (s) => s !== 'business_management',
      ),
    });

    const resultado = await salud.execute('org');

    expect(resultado.scopesRequeridosFaltantes.sort()).toEqual(
      ['business_management', ...SCOPES_WHATSAPP].sort(),
    );
    expect(resultado.tieneFaltantesDeseados).toBe(true);
    expect(resultado.scopesSolicitados.sort()).toEqual(
      [...SCOPES_LEAD_ADS_Y_PUBLICIDAD, ...SCOPES_WHATSAPP].sort(),
    );
  });

  it('todo OK cuando el token tiene los requeridos; WhatsApp no se lista sin módulo', async () => {
    const { salud, graph } = fixture(['META_LEADS']);
    graph.debugToken.mockResolvedValue({
      isValid: true,
      scopes: SCOPES_LEAD_ADS_Y_PUBLICIDAD,
    });

    const resultado = await salud.execute('org');

    expect(resultado.scopesRequeridosFaltantes).toEqual([]);
    expect(resultado.tieneFaltantesDeseados).toBe(false);
    expect(resultado.features.map((f) => f.grupo)).not.toContain('whatsapp');
  });
});
