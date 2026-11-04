import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { OrganizacionRol, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import {
  filtrarPorModulos,
  normalizarPermisos,
  PERMISOS_CATALOGO,
  ROLES_SISTEMA,
} from '../../shared/domain/permisos';
import {
  resolverPermisosEfectivos,
  type MembresiaConPermisos,
} from '../../shared/infrastructure/permisos-efectivos';
import { asegurarRolesSistema, esSubconjunto } from './roles-empresa';

type Tx = Prisma.TransactionClient;

export const MAXIMO_ROLES_ACTIVOS = 30;

export interface DatosRol {
  nombre?: string;
  descripcion?: string | null;
  permisos?: string[];
}

/**
 * Roles y permisos de una empresa (PLAN-PERMISOS-GRANULARES.md §5.3).
 * Nadie otorga permisos que no tiene ni edita su propio rol; el propietario
 * no tiene esa limitación. Los cambios se serializan por empresa.
 */
@Injectable()
export class RolesEmpresaService {
  constructor(private readonly prisma: PrismaService) {}

  private async modulosHabilitados(tx: Tx, org: string) {
    const filas = await tx.organizacionModulo.findMany({
      where: {
        organizacionId: org,
        habilitado: 1,
        estado: 1,
        modulo: { estado: 1, grupo: { estado: 1 } },
      },
      select: {
        modulo: { select: { codigo: true, nombre: true, orden: true } },
      },
      orderBy: { modulo: { orden: 'asc' } },
    });
    return filas.map((f) => f.modulo);
  }

  private async ejecutar<T>(
    org: string,
    ctx: RequestContext,
    fn: (tx: Tx, actor: MembresiaConPermisos) => Promise<T>,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`org-roles:${org.toLowerCase()}`}, 0))::text`;
        // Permisos releídos bajo el bloqueo, no los del inicio de la petición.
        const actor = await resolverPermisosEfectivos(tx, org, ctx.usuarioId, {
          exigirCuentaActiva: true,
        });
        if (
          !actor ||
          !(
            actor.permisos.includes('roles.gestionar') ||
            actor.permisos.includes('usuarios.gestionar')
          )
        )
          throw new ForbiddenException(
            'No tienes permiso para gestionar roles',
          );
        await asegurarRolesSistema(tx, org, ctx.usuarioId);
        return fn(tx, actor);
      },
      { timeout: 20000 },
    );
  }

  private exigirGestionRoles(actor: MembresiaConPermisos) {
    if (!actor.permisos.includes('roles.gestionar'))
      throw new ForbiddenException('No tienes permiso para gestionar roles');
  }

  /** Qué puede tocar el actor sobre un rol, con el motivo para la pantalla. */
  private evaluarEdicion(
    rol: OrganizacionRol,
    actor: MembresiaConPermisos,
    activos: ReadonlySet<string>,
  ): { editable: boolean; motivo: string | null } {
    if (rol.codigo === 'PROPIETARIO')
      return {
        editable: false,
        motivo: 'El propietario tiene todos los permisos.',
      };
    if (actor.rol === 'PROPIETARIO') return { editable: true, motivo: null };
    if (!actor.permisos.includes('roles.gestionar'))
      return {
        editable: false,
        motivo: 'No tienes permiso para gestionar roles.',
      };
    if (actor.rolId === rol.id)
      return { editable: false, motivo: 'No puedes editar tu propio rol.' };
    if (
      !esSubconjunto(filtrarPorModulos(rol.permisos, activos), actor.permisos)
    )
      return {
        editable: false,
        motivo: 'Este rol tiene permisos que tú no tienes.',
      };
    return { editable: true, motivo: null };
  }

  private exigirEditable(
    rol: OrganizacionRol,
    actor: MembresiaConPermisos,
    activos: ReadonlySet<string>,
  ) {
    const { editable, motivo } = this.evaluarEdicion(rol, actor, activos);
    if (!editable) throw new ForbiddenException(motivo ?? 'Rol no editable');
  }

  /**
   * Normaliza lo pedido y conserva los permisos guardados de módulos hoy
   * apagados: la pantalla no los muestra y no deben perderse al guardar.
   */
  private permisosAGuardar(
    pedidos: readonly string[],
    anteriores: readonly string[],
    actor: MembresiaConPermisos,
    activos: ReadonlySet<string>,
  ) {
    const visibles = filtrarPorModulos(normalizarPermisos(pedidos), activos);
    if (actor.rol !== 'PROPIETARIO' && !esSubconjunto(visibles, actor.permisos))
      throw new ForbiddenException(
        'No puedes otorgar permisos que tú no tienes',
      );
    const ocultos = anteriores.filter(
      (p) => !filtrarPorModulos([p], activos).length,
    );
    return normalizarPermisos([...visibles, ...ocultos]);
  }

  private async rol(tx: Tx, org: string, id: string) {
    const rol = await tx.organizacionRol.findFirst({
      where: { id, organizacionId: org, estado: 1 },
    });
    if (!rol) throw new NotFoundException('Rol no encontrado');
    return rol;
  }

  private async nombreLibre(tx: Tx, org: string, nombre: string, id?: string) {
    const existe = await tx.organizacionRol.findFirst({
      where: {
        organizacionId: org,
        estado: 1,
        nombre: { equals: nombre, mode: 'insensitive' },
        ...(id ? { id: { not: id } } : {}),
      },
    });
    if (existe) throw new ConflictException('Ya existe un rol con ese nombre');
  }

  private evento(
    tx: Tx,
    rol: OrganizacionRol,
    actorId: string,
    accion: string,
    anteriores: readonly string[],
  ) {
    return tx.organizacionRolEvento.create({
      data: {
        organizacionId: rol.organizacionId,
        rolId: rol.id,
        actorId,
        accion,
        nombre: rol.nombre,
        permisosAnteriores: [...anteriores],
        permisosNuevos: rol.permisos,
      },
    });
  }

  /** Catálogo agrupado por módulo, solo con los módulos activos de la empresa. */
  async catalogo(org: string, ctx: RequestContext) {
    return this.ejecutar(org, ctx, async (tx) => {
      const modulos = await this.modulosHabilitados(tx, org);
      const grupos = [
        { codigo: null as string | null, nombre: 'Empresa' },
        ...modulos.map((m) => ({
          codigo: m.codigo,
          nombre: m.nombre,
        })),
      ];
      return grupos
        .map((g) => ({
          modulo: g.codigo,
          nombre: g.nombre,
          permisos: PERMISOS_CATALOGO.filter((p) => p.modulo === g.codigo).map(
            (p) => ({
              codigo: p.codigo,
              nombre: p.nombre,
              descripcion: p.descripcion,
              requiere: [...p.requiere],
            }),
          ),
        }))
        .filter((g) => g.permisos.length > 0);
    });
  }

  async listar(org: string, ctx: RequestContext) {
    return this.ejecutar(org, ctx, async (tx, actor) => {
      const activos = new Set(
        (await this.modulosHabilitados(tx, org)).map((m) => m.codigo),
      );
      const roles = await tx.organizacionRol.findMany({
        where: { organizacionId: org, estado: 1 },
        orderBy: [{ esSistema: 'desc' }, { fechaCreacion: 'asc' }],
      });
      const membresias = await tx.organizacionUsuario.findMany({
        where: { organizacionId: org, estado: 1 },
        select: { rol: true, rolId: true },
      });
      const orden = ROLES_SISTEMA.map((r) => r.codigo as string);
      return roles
        .sort((a, b) => {
          const ia = a.codigo ? orden.indexOf(a.codigo) : orden.length;
          const ib = b.codigo ? orden.indexOf(b.codigo) : orden.length;
          return ia - ib;
        })
        .map((r) => ({
          id: r.id,
          codigo: r.codigo,
          nombre: r.nombre,
          descripcion: r.descripcion,
          esSistema: r.esSistema === 1,
          permisos: filtrarPorModulos(
            r.codigo === 'PROPIETARIO'
              ? PERMISOS_CATALOGO.map((p) => p.codigo)
              : r.permisos,
            activos,
          ),
          usuarios: membresias.filter((m) =>
            m.rolId ? m.rolId === r.id : !!r.codigo && m.rol === r.codigo,
          ).length,
          esPropio: actor.rolId === r.id,
          ...this.evaluarEdicion(r, actor, activos),
        }));
    });
  }

  async crear(
    org: string,
    input: Required<Pick<DatosRol, 'nombre'>> & DatosRol,
    ctx: RequestContext,
  ) {
    return this.ejecutar(org, ctx, async (tx, actor) => {
      this.exigirGestionRoles(actor);
      const total = await tx.organizacionRol.count({
        where: { organizacionId: org, estado: 1 },
      });
      if (total >= MAXIMO_ROLES_ACTIVOS)
        throw new ConflictException(
          `La empresa alcanzó el máximo de ${MAXIMO_ROLES_ACTIVOS} roles`,
        );
      const nombre = input.nombre.trim();
      await this.nombreLibre(tx, org, nombre);
      const activos = new Set(
        (await this.modulosHabilitados(tx, org)).map((m) => m.codigo),
      );
      const rol = await tx.organizacionRol.create({
        data: {
          organizacionId: org,
          nombre,
          descripcion: input.descripcion?.trim() || null,
          permisos: this.permisosAGuardar(
            input.permisos ?? [],
            [],
            actor,
            activos,
          ),
          usuarioCreacion: ctx.usuarioId,
        },
      });
      await this.evento(tx, rol, ctx.usuarioId, 'CREAR', []);
      return { id: rol.id };
    });
  }

  async actualizar(
    org: string,
    id: string,
    input: DatosRol,
    ctx: RequestContext,
  ) {
    return this.ejecutar(org, ctx, async (tx, actor) => {
      this.exigirGestionRoles(actor);
      const anterior = await this.rol(tx, org, id);
      const activos = new Set(
        (await this.modulosHabilitados(tx, org)).map((m) => m.codigo),
      );
      this.exigirEditable(anterior, actor, activos);
      const nombre = input.nombre?.trim();
      if (nombre && anterior.esSistema === 1 && nombre !== anterior.nombre) {
        // Los roles de sistema conservan su nombre para que el equipo los reconozca.
        throw new ConflictException('Los roles de sistema no se renombran');
      }
      if (nombre) await this.nombreLibre(tx, org, nombre, id);
      const rol = await tx.organizacionRol.update({
        where: { id },
        data: {
          ...(nombre ? { nombre } : {}),
          ...(input.descripcion !== undefined
            ? { descripcion: input.descripcion?.trim() || null }
            : {}),
          ...(input.permisos
            ? {
                permisos: this.permisosAGuardar(
                  input.permisos,
                  anterior.permisos,
                  actor,
                  activos,
                ),
              }
            : {}),
          usuarioEdicion: ctx.usuarioId,
        },
      });
      await this.evento(tx, rol, ctx.usuarioId, 'EDITAR', anterior.permisos);
      return { id };
    });
  }

  /** Vuelve un rol de sistema editable a los permisos por defecto. */
  async restaurar(org: string, id: string, ctx: RequestContext) {
    return this.ejecutar(org, ctx, async (tx, actor) => {
      this.exigirGestionRoles(actor);
      const anterior = await this.rol(tx, org, id);
      const sistema = ROLES_SISTEMA.find((r) => r.codigo === anterior.codigo);
      if (anterior.esSistema !== 1 || !sistema)
        throw new ConflictException('Solo se restauran roles de sistema');
      const activos = new Set(
        (await this.modulosHabilitados(tx, org)).map((m) => m.codigo),
      );
      this.exigirEditable(anterior, actor, activos);
      if (
        actor.rol !== 'PROPIETARIO' &&
        !esSubconjunto(
          filtrarPorModulos(sistema.permisos, activos),
          actor.permisos,
        )
      )
        throw new ForbiddenException(
          'No puedes otorgar permisos que tú no tienes',
        );
      const rol = await tx.organizacionRol.update({
        where: { id },
        data: {
          nombre: sistema.nombre,
          descripcion: sistema.descripcion,
          permisos: [...sistema.permisos],
          usuarioEdicion: ctx.usuarioId,
        },
      });
      await this.evento(tx, rol, ctx.usuarioId, 'RESTAURAR', anterior.permisos);
      return { id };
    });
  }

  /** Los roles no se borran: se desactivan si nadie activo los usa. */
  async desactivar(org: string, id: string, ctx: RequestContext) {
    return this.ejecutar(org, ctx, async (tx, actor) => {
      this.exigirGestionRoles(actor);
      const anterior = await this.rol(tx, org, id);
      if (anterior.esSistema === 1)
        throw new ConflictException('Los roles de sistema no se eliminan');
      const activos = new Set(
        (await this.modulosHabilitados(tx, org)).map((m) => m.codigo),
      );
      this.exigirEditable(anterior, actor, activos);
      const usuarios = await tx.organizacionUsuario.count({
        where: { organizacionId: org, rolId: id, estado: 1 },
      });
      if (usuarios)
        throw new ConflictException(
          `El rol tiene ${usuarios} usuario(s) activo(s). Asígnales otro rol primero.`,
        );
      const rol = await tx.organizacionRol.update({
        where: { id },
        data: { estado: 0, usuarioEdicion: ctx.usuarioId },
      });
      await this.evento(
        tx,
        rol,
        ctx.usuarioId,
        'DESACTIVAR',
        anterior.permisos,
      );
      return { id };
    });
  }
}
