export interface FeaturePermisoMeta {
  id: string;
  label: string;
  scopesRequeridos: string[];
  /** núcleo = siempre solicitado en OAuth, no desactivable; optin = el usuario decide. */
  tipo: 'nucleo' | 'optin';
}

/** Catálogo de scopes Graph relevantes al dominio de este CRM (Pages, Lead Ads,
 * Marketing API, Instagram, Business Manager) — PLAN.md Fase 16
 * §5/§16.4: "la matriz tenga todos los scopes disponibles" para que el usuario
 * pueda activar/desactivar y solicitar lo que necesite, sin limitarse a los ya
 * usados por features construidas hoy. Quedan fuera deliberadamente los scopes
 * de WhatsApp/CAPI (§11: oleadas C/D) y los de Facebook Login personal
 * (email, public_profile, etc. — sin relación con este dominio B2B). */
export const MATRIZ_PERMISOS_META: FeaturePermisoMeta[] = [
  // Núcleo — Lead Ads mínimo, siempre solicitado, no desactivable.
  {
    id: 'pages_list',
    label: 'Listar / vincular páginas',
    scopesRequeridos: ['pages_show_list'],
    tipo: 'nucleo',
  },
  {
    id: 'pages_webhook',
    label: 'Suscribir webhook leadgen',
    scopesRequeridos: ['pages_manage_metadata'],
    tipo: 'nucleo',
  },
  {
    id: 'leads',
    label: 'Leer leads / backfill',
    scopesRequeridos: ['leads_retrieval'],
    tipo: 'nucleo',
  },
  {
    id: 'ads_insights',
    label: 'Cuentas publicitarias e Insights (lectura)',
    // Núcleo: sin esto, la resolución de nombre de campaña/conjunto/anuncio
    // de cada lead falla en silencio (queda como "errores" en el backfill) —
    // es parte del flujo mínimo de Lead Ads según la doc de Meta, no un
    // add-on opcional. Confirmado por el incidente real de Domaria (2026-08-20).
    scopesRequeridos: ['ads_read'],
    tipo: 'nucleo',
  },

  // Opt-in — Business Manager y Marketing API.
  {
    id: 'pages_business',
    label: 'Páginas en Business Manager / Suite',
    scopesRequeridos: ['business_management'],
    tipo: 'optin',
  },
  {
    id: 'ads_management',
    label: 'Gestionar campañas y anuncios',
    scopesRequeridos: ['ads_management'],
    tipo: 'optin',
  },
  {
    id: 'catalog_management',
    label: 'Gestionar catálogos de productos',
    scopesRequeridos: ['catalog_management'],
    tipo: 'optin',
  },

  {
    id: 'pages_ads',
    label: 'Formularios Lead Ads y anuncios de la página',
    // Núcleo: GET /{page-id}/leadgen_forms lo exige — sin esto, "Sincronizar
    // formularios" falla con (#200) para TODA página, no es opcional para
    // el flujo de Lead Ads (incidente real de Domaria, 2026-08-20).
    scopesRequeridos: ['pages_manage_ads'],
    tipo: 'nucleo',
  },

  // Opt-in — contenido y mensajería de la página.
  {
    id: 'pages_engagement',
    label: 'Leer contenido y engagement de la página',
    scopesRequeridos: ['pages_read_engagement'],
    tipo: 'optin',
  },
  {
    id: 'pages_posts',
    label: 'Publicar y editar publicaciones de la página',
    scopesRequeridos: ['pages_manage_posts'],
    tipo: 'optin',
  },
  {
    id: 'pages_comments',
    label: 'Gestionar comentarios y reacciones de la página',
    scopesRequeridos: ['pages_manage_engagement'],
    tipo: 'optin',
  },
  {
    id: 'pages_messaging',
    label: 'Mensajería de Messenger de la página',
    scopesRequeridos: ['pages_messaging'],
    tipo: 'optin',
  },

  // Opt-in — Instagram (vinculado a la página / Business Manager).
  {
    id: 'instagram_basic',
    label: 'Leer perfil y contenido de Instagram',
    scopesRequeridos: ['instagram_basic'],
    tipo: 'optin',
  },
  {
    id: 'instagram_insights',
    label: 'Métricas de Instagram',
    scopesRequeridos: ['instagram_manage_insights'],
    tipo: 'optin',
  },
  {
    id: 'instagram_comments',
    label: 'Gestionar comentarios de Instagram',
    scopesRequeridos: ['instagram_manage_comments'],
    tipo: 'optin',
  },
  {
    id: 'instagram_publish',
    label: 'Publicar contenido en Instagram',
    scopesRequeridos: ['instagram_content_publish'],
    tipo: 'optin',
  },
  {
    id: 'instagram_messaging',
    label: 'Mensajes directos de Instagram',
    scopesRequeridos: ['instagram_manage_messages'],
    tipo: 'optin',
  },
];

export const FEATURES_NUCLEO_IDS = MATRIZ_PERMISOS_META.filter(
  (f) => f.tipo === 'nucleo',
).map((f) => f.id);

export function scopesDeFeatures(featureIds: string[]): string[] {
  const ids = new Set(featureIds);
  const scopes = new Set<string>();
  for (const feature of MATRIZ_PERMISOS_META) {
    if (ids.has(feature.id)) {
      for (const scope of feature.scopesRequeridos) scopes.add(scope);
    }
  }
  return [...scopes];
}

export function buscarFeature(
  featureId: string,
): FeaturePermisoMeta | undefined {
  return MATRIZ_PERMISOS_META.find((f) => f.id === featureId);
}

/** Lee las features deseadas persistidas (JSON) y siempre incluye las núcleo,
 * incluso si la columna aún es NULL (conexiones creadas antes de Fase 16.4). */
export function featuresDeseadasDe(featuresDeseadas: unknown): string[] {
  const persistidas =
    Array.isArray(featuresDeseadas) &&
    featuresDeseadas.every((x) => typeof x === 'string')
      ? featuresDeseadas
      : [];
  return [...new Set([...FEATURES_NUCLEO_IDS, ...persistidas])];
}
