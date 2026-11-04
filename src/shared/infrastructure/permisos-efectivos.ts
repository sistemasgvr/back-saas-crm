import type { Prisma, PrismaClient } from '@prisma/client';
import type { RolOrganizacion } from '../../auth/domain/request-context.interface';
import {
  filtrarPorModulos,
  PERMISOS_CATALOGO,
  permisosPorDefecto,
  ROLES_SISTEMA,
  TODOS_LOS_PERMISOS,
} from '../domain/permisos';

type Db = PrismaClient | Prisma.TransactionClient;

export interface MembresiaConPermisos {
  rol: RolOrganizacion;
  rolId: string | null;
  rolNombre: string;
  /** Permisos efectivos: los del rol ∩ módulos habilitados de la empresa. */
  permisos: string[];
}

interface RolGuardado {
  id: string;
  nombre: string;
  permisos: string[];
}

/**
 * Permisos del rol antes del techo de módulos (PLAN-PERMISOS-GRANULARES.md §4.2):
 * PROPIETARIO = todos; rol_id activo de la empresa; rol de sistema guardado
 * con codigo = rol; permisos por defecto si la empresa no tiene roles; si no,
 * ninguno (falla cerrada).
 */
export function permisosDelRol(
  rol: string,
  asignado: RolGuardado | null,
  sistema: RolGuardado | null,
  empresaTieneRoles: boolean,
): { rolId: string | null; rolNombre: string; permisos: string[] } {
  const nombreSistema =
    ROLES_SISTEMA.find((r) => r.codigo === rol)?.nombre ?? 'Sin rol';
  if (rol === 'PROPIETARIO') {
    return {
      rolId: sistema?.id ?? null,
      rolNombre: sistema?.nombre ?? nombreSistema,
      permisos: [...TODOS_LOS_PERMISOS],
    };
  }
  if (asignado) {
    return {
      rolId: asignado.id,
      rolNombre: asignado.nombre,
      permisos: asignado.permisos,
    };
  }
  if (sistema) {
    return {
      rolId: sistema.id,
      rolNombre: sistema.nombre,
      permisos: sistema.permisos,
    };
  }
  if (!empresaTieneRoles) {
    return {
      rolId: null,
      rolNombre: nombreSistema,
      permisos: permisosPorDefecto(rol),
    };
  }
  return { rolId: null, rolNombre: nombreSistema, permisos: [] };
}

export interface OpcionesPermisos {
  /** Exige además usuarios.estado = 1. */
  exigirCuentaActiva?: boolean;
  /**
   * false = solo los permisos del rol, sin el techo de módulos. Para
   * revalidar dentro de una transacción cuando ModuleGuard ya exigió el
   * módulo del endpoint y el permiso pertenece a ese mismo módulo.
   */
  techoModulos?: boolean;
}

/**
 * Permisos efectivos de una membresía concreta (activa o no): rol resuelto
 * según §4.2 ∩ módulos habilitados de la empresa.
 */
export async function permisosDeMembresia(
  db: Db,
  organizacionId: string,
  membresia: { rol: string; rolId: string | null },
  opciones: OpcionesPermisos = {},
): Promise<MembresiaConPermisos> {
  const techo = opciones.techoModulos ?? true;
  const [asignadoGuardado, rolesSistema, modulos] = await Promise.all([
    membresia.rolId
      ? db.organizacionRol.findFirst({
          where: { id: membresia.rolId, organizacionId, estado: 1 },
          select: { id: true, nombre: true, permisos: true },
        })
      : null,
    db.organizacionRol.findMany({
      where: { organizacionId, esSistema: 1, estado: 1 },
      select: { id: true, codigo: true, nombre: true, permisos: true },
    }),
    techo
      ? db.organizacionModulo.findMany({
          where: {
            organizacionId,
            habilitado: 1,
            estado: 1,
            modulo: { estado: 1, grupo: { estado: 1 } },
          },
          select: { modulo: { select: { codigo: true } } },
        })
      : null,
  ]);

  const empresaTieneRoles =
    rolesSistema.length > 0 ||
    (await db.organizacionRol.count({ where: { organizacionId } })) > 0;
  const base = permisosDelRol(
    membresia.rol,
    asignadoGuardado ?? null,
    rolesSistema.find((r) => r.codigo === membresia.rol) ?? null,
    empresaTieneRoles,
  );

  return {
    rol: membresia.rol as RolOrganizacion,
    rolId: base.rolId,
    rolNombre: base.rolNombre,
    permisos: modulos
      ? filtrarPorModulos(
          base.permisos,
          modulos.map((m) => m.modulo.codigo),
        )
      : filtrarPorModulos(
          base.permisos,
          new Set(PERMISOS_CATALOGO.map((p) => p.modulo ?? '')),
        ),
  };
}

/**
 * Lee en vivo la membresía activa, su rol y los módulos habilitados. null si
 * la membresía, la cuenta (con exigirCuentaActiva) o la empresa no están
 * activas. Acepta transacciones para los servicios que revalidan dentro de su
 * propio bloqueo.
 */
export async function resolverPermisosEfectivos(
  db: Db,
  organizacionId: string,
  usuarioId: string,
  opciones: OpcionesPermisos = {},
): Promise<MembresiaConPermisos | null> {
  const membresia = await db.organizacionUsuario.findFirst({
    where: {
      organizacionId,
      usuarioId,
      estado: 1,
      organizacion: { estado: 1 },
      ...(opciones.exigirCuentaActiva ? { usuario: { estado: 1 } } : {}),
    },
    select: { rol: true, rolId: true },
  });
  if (!membresia) return null;
  return permisosDeMembresia(db, organizacionId, membresia, opciones);
}
