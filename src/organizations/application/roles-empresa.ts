import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { RolOrganizacion } from '../../auth/domain/request-context.interface';
import { ROLES_SISTEMA } from '../../shared/domain/permisos';
import {
  permisosDeMembresia,
  type MembresiaConPermisos,
} from '../../shared/infrastructure/permisos-efectivos';

type Tx = Prisma.TransactionClient;

/** Crea los roles de sistema que falten (empresas creadas después de migrar). */
export async function asegurarRolesSistema(
  tx: Tx,
  organizacionId: string,
  actorId?: string,
) {
  await tx.organizacionRol.createMany({
    data: ROLES_SISTEMA.map((r) => ({
      organizacionId,
      codigo: r.codigo,
      nombre: r.nombre,
      descripcion: r.descripcion,
      esSistema: 1,
      permisos: [...r.permisos],
      usuarioCreacion: actorId,
    })),
    skipDuplicates: true,
  });
}

export function esSubconjunto(
  permisos: readonly string[],
  de: readonly string[],
): boolean {
  const base = new Set(de);
  return permisos.every((p) => base.has(p));
}

export interface RolDestino {
  rol: RolOrganizacion;
  rolId: string | null;
  efectivo: MembresiaConPermisos;
}

/**
 * Rol que se asignará a una membresía. `rolId` (rol de la empresa) tiene
 * prioridad; `rol` (código de sistema) se mantiene por compatibilidad con
 * la API anterior y con la plataforma.
 */
export async function resolverRolDestino(
  tx: Tx,
  organizacionId: string,
  input: { rol?: RolOrganizacion; rolId?: string },
): Promise<RolDestino | null> {
  if (input.rolId) {
    const rol = await tx.organizacionRol.findFirst({
      where: { id: input.rolId, organizacionId, estado: 1 },
    });
    if (!rol) throw new NotFoundException('Rol no encontrado en esta empresa');
    const codigo = (rol.codigo ?? 'PERSONALIZADO') as RolOrganizacion;
    return {
      rol: codigo,
      rolId: rol.id,
      efectivo: await permisosDeMembresia(tx, organizacionId, {
        rol: codigo,
        rolId: rol.id,
      }),
    };
  }
  if (input.rol) {
    if (input.rol === 'PERSONALIZADO')
      throw new BadRequestException('Indica el rol personalizado (rolId)');
    return {
      rol: input.rol,
      rolId: null,
      efectivo: await permisosDeMembresia(tx, organizacionId, {
        rol: input.rol,
        rolId: null,
      }),
    };
  }
  return null;
}
