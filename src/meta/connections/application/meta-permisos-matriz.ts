export type GrupoPermisoMeta =
  'paginas_leads' | 'publicidad' | 'negocio' | 'whatsapp' | 'opcional';

export interface FeaturePermisoMeta {
  id: string;
  label: string;
  /** Qué funcionalidad del CRM deja de andar si falta (se muestra en la UI). */
  descripcion: string;
  grupo: GrupoPermisoMeta;
  scopesRequeridos: string[];
  /** nucleo = requerido por una funcionalidad que YA existe en el CRM: siempre
   * se pide en OAuth y no se puede desactivar. optin = catálogo sin uso actual,
   * el usuario decide si lo pide. */
  tipo: 'nucleo' | 'optin';
  /** Código de módulo (organizacion_modulos) sin el cual la feature no aplica:
   * no se pide en OAuth ni cuenta como faltante si la org no lo tiene activo.
   * Pedir scopes de un producto que la Meta App de la org no tiene agregado
   * hace que el diálogo de Meta falle con "Invalid Scopes" para sus admins. */
  moduloRequerido?: string;
}

/**
 * Matriz única de permisos (scopes) de Meta Graph API v26 que usa el CRM.
 * El botón «Solicitar permisos» (Configuración → Meta → Conexión) y
 * «Conectar con Meta» piden TODOS los `nucleo` aplicables a la org en un solo
 * diálogo OAuth, más los `optin` que la org haya marcado.
 *
 * ── Al agregar una funcionalidad nueva que llame a otro endpoint de Graph ──
 * 1. Revisar en https://developers.facebook.com/docs/permissions qué permiso
 *    exige el endpoint (y sus dependencias).
 * 2. Si el scope ya está acá, actualizar `descripcion` para mencionarla.
 *    Si no, agregar una entrada `tipo: 'nucleo'` en el grupo que corresponda
 *    (o pasar a `nucleo` la entrada `optin` existente, conservando su `id`:
 *    está persistido en meta_conexiones.features_deseadas).
 * 3. Si la funcionalidad pertenece a un módulo contratable, poner
 *    `moduloRequerido` con su código.
 * 4. Agregar el permiso en App Review / Advanced Access de la Meta App
 *    (sin eso, solo lo otorgan usuarios con rol en la app).
 * No hace falta tocar el frontend: el panel de permisos se arma desde acá.
 */
export const MATRIZ_PERMISOS_META: FeaturePermisoMeta[] = [
  // ── Páginas y Lead Ads ──
  {
    id: 'pages_list',
    label: 'Listar y vincular páginas',
    descripcion: 'Páginas disponibles, token de página para webhook y leads.',
    grupo: 'paginas_leads',
    scopesRequeridos: ['pages_show_list'],
    tipo: 'nucleo',
  },
  {
    id: 'pages_webhook',
    label: 'Webhook de leads de la página',
    descripcion:
      'Suscribir/verificar el webhook leadgen (leads nuevos en tiempo real).',
    grupo: 'paginas_leads',
    scopesRequeridos: ['pages_manage_metadata'],
    tipo: 'nucleo',
  },
  {
    id: 'pages_engagement',
    label: 'Leer datos de la página',
    // Dependencia de leads_retrieval, ads_management y business_management
    // según la doc de permisos de Meta (incidente Domaria 2026-08-20).
    descripcion:
      'Datos de la página; dependencia obligatoria de leads y publicidad.',
    grupo: 'paginas_leads',
    scopesRequeridos: ['pages_read_engagement'],
    tipo: 'nucleo',
  },
  {
    id: 'pages_ads',
    label: 'Formularios Lead Ads de la página',
    // GET /{page-id}/leadgen_forms lo exige — sin esto «Sincronizar
    // formularios» falla con (#200) para toda página.
    descripcion: 'Sincronizar formularios y contar leads por formulario.',
    grupo: 'paginas_leads',
    scopesRequeridos: ['pages_manage_ads'],
    tipo: 'nucleo',
  },
  {
    id: 'leads',
    label: 'Leer leads',
    descripcion:
      'Recibir leads del webhook y reimportar (backfill) por formulario.',
    grupo: 'paginas_leads',
    scopesRequeridos: ['leads_retrieval'],
    tipo: 'nucleo',
  },

  // ── Publicidad y estadísticas ──
  {
    id: 'ads_insights',
    label: 'Cuentas publicitarias y estadísticas',
    // Sin esto la resolución de nombre de campaña/conjunto/anuncio de cada
    // lead falla en silencio (incidente Domaria 2026-08-20). Según la doc de
    // permisos también cubre el envío server-side (Conversions API).
    descripcion:
      'Listar cuentas, sincronizar campañas/conjuntos/anuncios, refrescar Insights (gasto, CPL) y enviar eventos de Conversions API.',
    grupo: 'publicidad',
    scopesRequeridos: ['ads_read'],
    tipo: 'nucleo',
  },
  {
    id: 'ads_management',
    label: 'Datos de anuncio en leads',
    // Meta lo lista como dependencia de leads_retrieval para recuperar los
    // campos de anuncio (ad_id/adset_id/campaign_id) del lead.
    descripcion:
      'Campaña, conjunto y anuncio de origen de cada lead; dependencia de leads.',
    grupo: 'publicidad',
    scopesRequeridos: ['ads_management'],
    tipo: 'nucleo',
  },

  // ── Portafolio comercial (Business Manager) ──
  {
    // id histórico: era opt-in "Páginas en Business Manager / Suite".
    id: 'pages_business',
    label: 'Portafolio comercial (Business Manager)',
    // Dependencia de leads_retrieval en la doc de Meta, y GET /me/businesses
    // (listar las cuentas de WhatsApp del portafolio) lo exige.
    descripcion:
      'Páginas, cuentas y números de WhatsApp del portafolio; dependencia de leads.',
    grupo: 'negocio',
    scopesRequeridos: ['business_management'],
    tipo: 'nucleo',
  },

  // ── WhatsApp Business Platform (solo orgs con el módulo WHATSAPP) ──
  {
    id: 'whatsapp_management',
    label: 'Administrar WhatsApp Business',
    descripcion:
      'Vincular números, webhook del WABA, estado del número, plantillas y configuración de llamadas.',
    grupo: 'whatsapp',
    scopesRequeridos: ['whatsapp_business_management'],
    tipo: 'nucleo',
    moduloRequerido: 'WHATSAPP',
  },
  {
    id: 'whatsapp_messaging',
    label: 'Mensajes y llamadas de WhatsApp',
    descripcion:
      'Enviar mensajes, plantillas, multimedia y reacciones, bloquear contactos y llamadas.',
    grupo: 'whatsapp',
    scopesRequeridos: ['whatsapp_business_messaging'],
    tipo: 'nucleo',
    moduloRequerido: 'WHATSAPP',
  },

  // ── Opcionales: catálogo sin funcionalidad en el CRM todavía (Fase 16) ──
  // Cuando se construya una funcionalidad que use uno de estos, pasarlo a
  // `nucleo` (ver instrucciones arriba).
  {
    id: 'catalog_management',
    label: 'Gestionar catálogos de productos',
    descripcion: 'Sin funcionalidad en el CRM todavía.',
    grupo: 'opcional',
    scopesRequeridos: ['catalog_management'],
    tipo: 'optin',
  },
  {
    id: 'pages_posts',
    label: 'Publicar y editar publicaciones de la página',
    descripcion: 'Sin funcionalidad en el CRM todavía.',
    grupo: 'opcional',
    scopesRequeridos: ['pages_manage_posts'],
    tipo: 'optin',
  },
  {
    id: 'pages_comments',
    label: 'Gestionar comentarios y reacciones de la página',
    descripcion: 'Sin funcionalidad en el CRM todavía.',
    grupo: 'opcional',
    scopesRequeridos: ['pages_manage_engagement'],
    tipo: 'optin',
  },
  {
    id: 'pages_messaging',
    label: 'Mensajería de Messenger de la página',
    descripcion: 'Sin funcionalidad en el CRM todavía.',
    grupo: 'opcional',
    scopesRequeridos: ['pages_messaging'],
    tipo: 'optin',
  },
  {
    id: 'instagram_basic',
    label: 'Leer perfil y contenido de Instagram',
    descripcion: 'Sin funcionalidad en el CRM todavía.',
    grupo: 'opcional',
    scopesRequeridos: ['instagram_basic'],
    tipo: 'optin',
  },
  {
    id: 'instagram_insights',
    label: 'Métricas de Instagram',
    descripcion: 'Sin funcionalidad en el CRM todavía.',
    grupo: 'opcional',
    scopesRequeridos: ['instagram_manage_insights'],
    tipo: 'optin',
  },
  {
    id: 'instagram_comments',
    label: 'Gestionar comentarios de Instagram',
    descripcion: 'Sin funcionalidad en el CRM todavía.',
    grupo: 'opcional',
    scopesRequeridos: ['instagram_manage_comments'],
    tipo: 'optin',
  },
  {
    id: 'instagram_publish',
    label: 'Publicar contenido en Instagram',
    descripcion: 'Sin funcionalidad en el CRM todavía.',
    grupo: 'opcional',
    scopesRequeridos: ['instagram_content_publish'],
    tipo: 'optin',
  },
  {
    id: 'instagram_messaging',
    label: 'Mensajes directos de Instagram',
    descripcion: 'Sin funcionalidad en el CRM todavía.',
    grupo: 'opcional',
    scopesRequeridos: ['instagram_manage_messages'],
    tipo: 'optin',
  },
];

/** La feature aplica a la org: sin módulo exigido, o con ese módulo activo. */
export function featureAplica(
  feature: FeaturePermisoMeta,
  modulosActivos: ReadonlySet<string>,
): boolean {
  return (
    !feature.moduloRequerido || modulosActivos.has(feature.moduloRequerido)
  );
}

/** Features que la org usa hoy (núcleo aplicables) — lo que pide «Solicitar permisos». */
export function featuresRequeridasPara(
  modulosActivos: ReadonlySet<string>,
): FeaturePermisoMeta[] {
  return MATRIZ_PERMISOS_META.filter(
    (f) => f.tipo === 'nucleo' && featureAplica(f, modulosActivos),
  );
}

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

/** Features a pedir para la org: todas las núcleo aplicables + las opt-in
 * persistidas (JSON). Ignora ids desconocidos y núcleo de módulos inactivos;
 * tolera la columna NULL (conexiones creadas antes de Fase 16.4). */
export function featuresDeseadasDe(
  featuresDeseadas: unknown,
  modulosActivos: ReadonlySet<string>,
): string[] {
  const persistidas =
    Array.isArray(featuresDeseadas) &&
    featuresDeseadas.every((x) => typeof x === 'string')
      ? featuresDeseadas
      : [];
  const optin = persistidas.filter((id) => buscarFeature(id)?.tipo === 'optin');
  return [
    ...new Set([
      ...featuresRequeridasPara(modulosActivos).map((f) => f.id),
      ...optin,
    ]),
  ];
}
