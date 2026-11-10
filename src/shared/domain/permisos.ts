import type { RolOrganizacion } from '../../auth/domain/request-context.interface';

/**
 * Catálogo de permisos granulares (planificacion/permisos/PLAN-PERMISOS-GRANULARES.md §3).
 * Cada código corresponde a un chequeo real del backend. `modulo` es el techo
 * que pone la plataforma: si el módulo está apagado, el permiso no tiene efecto.
 */
export interface PermisoCatalogo {
  codigo: string;
  /** null = no depende de un módulo (configuración de la empresa). */
  modulo: string | null;
  nombre: string;
  descripcion: string;
  requiere: string[];
}

export const PERMISOS_CATALOGO = [
  {
    codigo: 'empresa.configurar',
    modulo: null,
    nombre: 'Configurar la empresa',
    descripcion: 'Ver y editar los datos de la empresa y el logo.',
    requiere: [],
  },
  {
    codigo: 'empresa.exportar',
    modulo: null,
    nombre: 'Exportar datos de la empresa',
    descripcion:
      'Descargar en CSV todos los leads, chats, campañas, inmuebles y usuarios, con sus archivos.',
    requiere: [],
  },
  {
    codigo: 'usuarios.gestionar',
    modulo: null,
    nombre: 'Gestionar usuarios',
    descripcion: 'Crear, editar, desactivar usuarios y asignarles un rol.',
    requiere: [],
  },
  {
    codigo: 'roles.gestionar',
    modulo: null,
    nombre: 'Gestionar roles',
    descripcion: 'Crear y editar roles y sus permisos.',
    requiere: [],
  },
  {
    codigo: 'dashboard.ver',
    modulo: 'DASHBOARD',
    nombre: 'Ver dashboard',
    descripcion: 'KPIs, anuncios y embudo de toda la empresa.',
    requiere: [],
  },
  {
    codigo: 'leads.ver',
    modulo: 'LEADS',
    nombre: 'Ver leads',
    descripcion: 'Leads, tablero y agenda propios y el pool sin asignar.',
    requiere: [],
  },
  {
    codigo: 'leads.ver_todos',
    modulo: 'LEADS',
    nombre: 'Ver leads de todo el equipo',
    descripcion:
      'Ver y operar leads, agenda e interesados de cualquier usuario.',
    requiere: ['leads.ver'],
  },
  {
    codigo: 'leads.editar',
    modulo: 'LEADS',
    nombre: 'Gestionar leads',
    descripcion: 'Cambiar la gestión, registrar actividades y visitas.',
    requiere: ['leads.ver'],
  },
  {
    codigo: 'leads.reclamar',
    modulo: 'LEADS',
    nombre: 'Tomar leads sin asignar',
    descripcion: 'Tomar leads del pool sin asignar.',
    requiere: ['leads.ver'],
  },
  {
    codigo: 'leads.asignar',
    modulo: 'LEADS',
    nombre: 'Asignar leads',
    descripcion: 'Asignar y liberar leads de otros usuarios.',
    requiere: ['leads.ver_todos'],
  },
  {
    codigo: 'leads.configurar',
    modulo: 'LEADS',
    nombre: 'Configurar leads',
    descripcion: 'Autoasignación y configuración del pipeline.',
    requiere: ['leads.ver'],
  },
  {
    codigo: 'inmuebles.ver',
    modulo: 'INMUEBLES',
    nombre: 'Ver inmuebles',
    descripcion: 'Catálogo de inmuebles e interesados.',
    requiere: [],
  },
  {
    codigo: 'inmuebles.crear',
    modulo: 'INMUEBLES',
    nombre: 'Crear inmuebles',
    descripcion: 'Registrar inmuebles nuevos.',
    requiere: ['inmuebles.ver'],
  },
  {
    codigo: 'inmuebles.editar',
    modulo: 'INMUEBLES',
    nombre: 'Editar inmuebles',
    descripcion: 'Modificar inmuebles existentes.',
    requiere: ['inmuebles.ver'],
  },
  {
    codigo: 'inmuebles.eliminar',
    modulo: 'INMUEBLES',
    nombre: 'Eliminar inmuebles',
    descripcion: 'Eliminar inmuebles del catálogo.',
    requiere: ['inmuebles.ver'],
  },
  {
    codigo: 'meta.ver',
    modulo: 'META_LEADS',
    nombre: 'Ver datos de Meta',
    descripcion: 'Campañas, anuncios, formularios y filtros de origen.',
    requiere: [],
  },
  {
    codigo: 'meta.configurar',
    modulo: 'META_LEADS',
    nombre: 'Configurar Meta Lead Ads',
    descripcion:
      'Conexión, páginas, cuentas publicitarias, formularios e insights.',
    requiere: ['meta.ver'],
  },
  {
    codigo: 'chats.ver',
    modulo: 'WHATSAPP',
    nombre: 'Ver chats',
    descripcion: 'Ver los chats propios y los que están sin asignar.',
    requiere: [],
  },
  {
    codigo: 'chats.ver_todos',
    modulo: 'WHATSAPP',
    nombre: 'Ver chats de todo el equipo',
    descripcion: 'Leer conversaciones y mensajes asignados a otros asesores.',
    requiere: ['chats.ver'],
  },
  {
    codigo: 'chats.responder',
    modulo: 'WHATSAPP',
    nombre: 'Responder chats',
    descripcion:
      'Escribir, enviar archivos y tomar el control en chats propios o libres.',
    requiere: ['chats.ver'],
  },
  {
    codigo: 'chats.gestionar_todos',
    modulo: 'WHATSAPP',
    nombre: 'Gestionar chats de todo el equipo',
    descripcion:
      'Escribir y tomar el control en chats de otros asesores y transferirlos.',
    requiere: ['chats.responder', 'chats.ver_todos'],
  },
  {
    codigo: 'chats.plantillas',
    modulo: 'WHATSAPP',
    nombre: 'Gestionar plantillas',
    descripcion: 'Ver todas las plantillas y crear nuevas.',
    requiere: ['chats.ver'],
  },
  {
    codigo: 'llamadas.usar',
    modulo: 'WHATSAPP',
    nombre: 'Usar llamadas',
    descripcion: 'Realizar y atender llamadas de WhatsApp.',
    requiere: ['chats.ver'],
  },
  {
    codigo: 'whatsapp.configurar',
    modulo: 'WHATSAPP',
    nombre: 'Configurar WhatsApp',
    descripcion: 'Conexiones de WhatsApp y coexistencia.',
    requiere: ['chats.ver'],
  },
  {
    codigo: 'bot.configurar',
    // WHATSAPP y no AUTOMATIZACIONES: es lo que exige hoy el endpoint.
    modulo: 'WHATSAPP',
    nombre: 'Configurar el bot',
    descripcion: 'Preferencias de atención del bot.',
    requiere: [],
  },
] as const satisfies readonly PermisoCatalogo[];

export type CodigoPermiso = (typeof PERMISOS_CATALOGO)[number]['codigo'];

const CODIGOS = new Set<string>(PERMISOS_CATALOGO.map((p) => p.codigo));
const POR_CODIGO = new Map<string, PermisoCatalogo>(
  PERMISOS_CATALOGO.map((p) => [p.codigo, p]),
);

export const TODOS_LOS_PERMISOS: readonly CodigoPermiso[] =
  PERMISOS_CATALOGO.map((p) => p.codigo);

/** Permisos de USUARIO hoy (rol mostrado como "Asesor"). */
const PERMISOS_USUARIO: readonly CodigoPermiso[] = [
  'leads.ver',
  'leads.editar',
  'leads.reclamar',
  'inmuebles.ver',
  'meta.ver',
  'chats.ver',
  'chats.responder',
  'llamadas.usar',
];

/** ADMINISTRADOR hoy tiene todo; se deja explícito por si el catálogo crece. */
const PERMISOS_ADMINISTRADOR: readonly CodigoPermiso[] = TODOS_LOS_PERMISOS;

/** Roles de sistema: reproducen exactamente los chequeos por rol anteriores. */
export const ROLES_SISTEMA = [
  {
    codigo: 'PROPIETARIO',
    nombre: 'Propietario',
    descripcion: 'Dueño de la cuenta. Tiene todos los permisos.',
    permisos: TODOS_LOS_PERMISOS,
  },
  {
    codigo: 'ADMINISTRADOR',
    nombre: 'Administrador',
    descripcion: 'Administra la empresa, el equipo y las integraciones.',
    permisos: PERMISOS_ADMINISTRADOR,
  },
  {
    codigo: 'USUARIO',
    nombre: 'Asesor',
    descripcion: 'Atiende sus leads y chats y los que están sin asignar.',
    permisos: PERMISOS_USUARIO,
  },
] as const;

export type CodigoRolSistema = (typeof ROLES_SISTEMA)[number]['codigo'];

export function esCodigoRolSistema(rol: string): rol is CodigoRolSistema {
  return ROLES_SISTEMA.some((r) => r.codigo === rol);
}

export function permisosPorDefecto(rol: string | null | undefined): string[] {
  const sistema = ROLES_SISTEMA.find((r) => r.codigo === rol);
  return sistema ? [...sistema.permisos] : [];
}

export function esPermisoValido(codigo: string): codigo is CodigoPermiso {
  return CODIGOS.has(codigo);
}

export function permisoDelCatalogo(
  codigo: string,
): PermisoCatalogo | undefined {
  return POR_CODIGO.get(codigo);
}

/**
 * Descarta códigos desconocidos, agrega los requeridos (cierre transitivo) y
 * devuelve la lista en el orden del catálogo, sin duplicados.
 */
export function normalizarPermisos(codigos: readonly string[]): string[] {
  const resultado = new Set<string>();
  const agregar = (codigo: string) => {
    const permiso = POR_CODIGO.get(codigo);
    if (!permiso || resultado.has(codigo)) return;
    resultado.add(codigo);
    for (const requerido of permiso.requiere) agregar(requerido);
  };
  for (const codigo of codigos) agregar(codigo);
  return TODOS_LOS_PERMISOS.filter((c) => resultado.has(c));
}

/** Techo de la plataforma: quita los permisos de módulos no habilitados. */
export function filtrarPorModulos(
  codigos: readonly string[],
  modulosHabilitados: ReadonlySet<string> | readonly string[],
): string[] {
  const habilitados =
    modulosHabilitados instanceof Set
      ? modulosHabilitados
      : new Set(modulosHabilitados);
  return codigos.filter((codigo) => {
    const permiso = POR_CODIGO.get(codigo);
    return (
      !!permiso && (permiso.modulo === null || habilitados.has(permiso.modulo))
    );
  });
}

export interface ContextoPermisos {
  rol?: RolOrganizacion | null;
  permisos?: readonly string[];
}

/**
 * Los permisos efectivos llegan desde OrgMembershipGuard. Si un llamador no
 * los trae (tareas internas, pruebas), se usan los del rol de sistema: mismo
 * comportamiento que antes y falla cerrada para roles personalizados.
 */
export function tienePermiso(
  ctx: ContextoPermisos,
  codigo: CodigoPermiso,
): boolean {
  const permisos = ctx.permisos ?? permisosPorDefecto(ctx.rol);
  return permisos.includes(codigo);
}
