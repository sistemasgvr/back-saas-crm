import { construirResultadoPaginado } from '../../shared/application/paginacion';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, OrganizacionUsuario } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../../auth/application/ports/password-hasher.port';
import type {
  RequestContext,
  RolOrganizacion,
} from '../../auth/domain/request-context.interface';
import { ControlAtencionService } from '../../whatsapp/messaging/application/control-atencion.service';
import { resolverUsuarioIdsRoundRobin } from '../../leads/domain/resolver-usuario-ids-round-robin';
import { membresiaQueConsumeCupo } from './membresia-cupo';
import { CrearNotificacionUseCase } from '../../notifications/application/use-cases/crear-notificacion.use-case';

export interface FiltrosUsuariosEmpresa {
  page: number;
  pageSize: number;
  q?: string;
  rol?: 'PROPIETARIO' | 'ADMINISTRADOR' | 'USUARIO';
  estado?: 'activo' | 'inactivo' | 'suspendido';
}

type Tx = Prisma.TransactionClient;
export interface DatosMiembro {
  email: string;
  nombre: string;
  apellido?: string;
  telefono?: string;
  password: string;
  rol: RolOrganizacion;
}
const noDisponible = 'Este email no está disponible. Contacta a soporte.';

/** Todas las altas y modificaciones de membresías se serializan por empresa.
 * El bloqueo de usuario impide vincular simultáneamente una cuenta a dos empresas. */
@Injectable()
export class GestionMembresiasService {
  private readonly logger = new Logger(GestionMembresiasService.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly control: ControlAtencionService,
    private readonly notificar: CrearNotificacionUseCase,
  ) {}

  private async bloquear(tx: Tx, clave: string) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clave}, 0))::text`;
  }

  private async autorizar(tx: Tx, org: string, ctx: RequestContext) {
    // No confiar en el rol ni en la marca de plataforma recibidos en el JWT.
    const actor = await tx.usuario.findUnique({ where: { id: ctx.usuarioId } });
    if (!actor || actor.estado !== 1)
      throw new ForbiddenException('Cuenta inactiva');
    if (ctx.esAdminPlataforma && actor.esAdminPlataforma === 1) return true;
    const m = await tx.organizacionUsuario.findUnique({
      where: {
        organizacionId_usuarioId: {
          organizacionId: org,
          usuarioId: ctx.usuarioId,
        },
      },
    });
    if (
      ctx.organizacionId !== org ||
      !m ||
      m.estado !== 1 ||
      !['PROPIETARIO', 'ADMINISTRADOR'].includes(m.rol)
    )
      throw new ForbiddenException('No tienes permiso para gestionar usuarios');
    return false;
  }

  private async ejecutar<T>(
    org: string,
    ctx: RequestContext,
    fn: (tx: Tx, plataforma: boolean) => Promise<T>,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.bloquear(tx, `org-usuarios:${org.toLowerCase()}`);
        const empresa = await tx.organizacion.findUnique({
          where: { id: org },
        });
        if (!empresa || empresa.estado !== 1)
          throw new NotFoundException('Empresa no disponible');
        const plataforma = await this.autorizar(tx, org, ctx);
        return fn(tx, plataforma);
      },
      { timeout: 20000 },
    );
  }

  private async cupo(tx: Tx, org: string) {
    const empresa = await tx.organizacion.findUniqueOrThrow({
      where: { id: org },
    });
    const activos = await tx.organizacionUsuario.count({
      where: { organizacionId: org, ...membresiaQueConsumeCupo },
    });
    if (empresa.limiteUsuarios !== null && activos >= empresa.limiteUsuarios)
      throw new ConflictException(
        'Se alcanzó el límite de usuarios activos. Contacta a soporte para ampliar el plan.',
      );
  }

  private proteger(
    m: OrganizacionUsuario | null,
    rol: string | undefined,
    estado: number | undefined,
    ctx: RequestContext,
    plataforma: boolean,
  ) {
    if (!plataforma && (m?.rol === 'PROPIETARIO' || rol === 'PROPIETARIO'))
      throw new ForbiddenException(
        'La plataforma gestiona las cuentas propietarias',
      );
    if (
      m?.usuarioId === ctx.usuarioId &&
      (estado === 0 || (rol && rol !== m.rol))
    )
      throw new ForbiddenException(
        'No puedes desactivarte ni cambiar tu propio rol',
      );
  }

  private async ultimoPropietario(
    tx: Tx,
    m: OrganizacionUsuario,
    rol?: string,
    estado?: number,
  ) {
    if (
      m.estado === 1 &&
      m.rol === 'PROPIETARIO' &&
      (estado === 0 || (rol && rol !== m.rol))
    ) {
      const otros = await tx.organizacionUsuario.count({
        where: {
          organizacionId: m.organizacionId,
          estado: 1,
          rol: 'PROPIETARIO',
          usuarioId: { not: m.usuarioId },
        },
      });
      if (!otros)
        throw new ConflictException(
          'La empresa debe conservar al menos un propietario activo',
        );
    }
  }

  private async unaEmpresa(
    tx: Tx,
    org: string,
    usuarioId: string,
    plataforma = false,
  ) {
    await this.bloquear(tx, `usuario-empresa:${usuarioId.toLowerCase()}`);
    if (
      await tx.organizacionUsuario.count({
        where: { usuarioId, organizacionId: { not: org } },
      })
    )
      throw plataforma
        ? await this.yaRegistrado(tx, usuarioId, org)
        : new ConflictException(noDisponible);
  }

  /** Comprobación previa para plataforma (p. ej. antes de crear una empresa
   * con su propietario); el alta vuelve a validarlo bajo bloqueo. */
  async verificarEmailLibre(email: string) {
    const existente = await this.prisma.usuario.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
    });
    if (existente) throw await this.yaRegistrado(this.prisma, existente.id);
  }

  /** Solo para plataforma: a una empresa cliente no se le revela otra empresa. */
  private async yaRegistrado(tx: Tx, usuarioId: string, org?: string) {
    const m = await tx.organizacionUsuario.findFirst({
      where: { usuarioId, ...(org ? { organizacionId: { not: org } } : {}) },
      orderBy: { estado: 'desc' },
      include: { organizacion: { select: { nombre: true } } },
    });
    return new ConflictException(
      m
        ? `Este correo ya está registrado en la empresa "${m.organizacion.nombre}"${m.estado === 1 ? '' : ' (desactivado)'}.`
        : 'Este correo ya está registrado en otra cuenta.',
    );
  }

  private async protegerCuentaPlataforma(
    tx: Tx,
    usuarioId: string,
    plataforma: boolean,
  ) {
    if (
      !plataforma &&
      (await tx.usuario.findUnique({ where: { id: usuarioId } }))
        ?.esAdminPlataforma === 1
    )
      throw new ForbiddenException('La plataforma gestiona esta cuenta');
  }

  private evento(
    tx: Tx,
    org: string,
    usuarioId: string,
    actor: string,
    accion: string,
    antes: OrganizacionUsuario | null,
    despues?: OrganizacionUsuario,
  ) {
    return tx.organizacionUsuarioEvento.create({
      data: {
        organizacionId: org,
        usuarioId,
        actorId: actor,
        accion,
        rolAnterior: antes?.rol,
        estadoAnterior: antes?.estado,
        rolNuevo: despues?.rol ?? antes?.rol,
        estadoNuevo: despues?.estado ?? antes?.estado,
      },
    });
  }

  async listar(
    org: string,
    ctx: RequestContext,
    query: FiltrosUsuariosEmpresa = { page: 1, pageSize: 20 },
  ) {
    return this.ejecutar(org, ctx, async (tx) => {
      const { page, pageSize } = query;
      const q = query.q?.trim();
      const where: Prisma.OrganizacionUsuarioWhereInput = {
        organizacionId: org,
        ...(query.rol ? { rol: query.rol } : {}),
        ...(query.estado === 'suspendido'
          ? { usuario: { estado: 0 } }
          : query.estado
            ? {
                estado: query.estado === 'activo' ? 1 : 0,
                usuario: { estado: 1 },
              }
            : {}),
        ...(q
          ? {
              AND: [
                {
                  usuario: {
                    OR: ['nombre', 'apellido', 'email', 'telefono'].map(
                      (campo) => ({
                        [campo]: { contains: q, mode: 'insensitive' },
                      }),
                    ),
                  },
                },
              ],
            }
          : {}),
      };
      const total = await tx.organizacionUsuario.count({ where });
      const miembros = await tx.organizacionUsuario.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          usuario: {
            select: {
              id: true,
              email: true,
              nombre: true,
              apellido: true,
              telefono: true,
              estado: true,
              debeCambiarPassword: true,
            },
          },
        },
        orderBy: [{ fechaCreacion: 'asc' }, { usuarioId: 'asc' }],
      });
      const empresa = await tx.organizacion.findUniqueOrThrow({
        where: { id: org },
      });
      const leads = await tx.lead.groupBy({
        by: ['asignadoUsuarioId'],
        where: { organizacionId: org, estado: 1 },
        _count: true,
      });
      return {
        ...construirResultadoPaginado(
          miembros.map((m) => ({
            ...m.usuario,
            estado: m.estado,
            cuentaActiva: m.usuario.estado === 1,
            rol: m.rol,
            leadsAsignados:
              leads.find((l) => l.asignadoUsuarioId === m.usuarioId)?._count ??
              0,
          })),
          total,
          page,
          pageSize,
        ),
        activos: await tx.organizacionUsuario.count({
          where: { organizacionId: org, ...membresiaQueConsumeCupo },
        }),
        limite: empresa.limiteUsuarios,
      };
    });
  }

  async crear(org: string, input: DatosMiembro, ctx: RequestContext) {
    const email = input.email.trim().toLowerCase();
    const passwordHash = await this.hasher.hash(input.password);
    return this.ejecutar(org, ctx, async (tx, plataforma) => {
      this.proteger(null, input.rol, 1, ctx, plataforma);
      await this.bloquear(tx, `usuario-email:${email}`);
      let usuario = await tx.usuario.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      });
      if (usuario) {
        const previa = await tx.organizacionUsuario.findUnique({
          where: {
            organizacionId_usuarioId: {
              organizacionId: org,
              usuarioId: usuario.id,
            },
          },
        });
        if (!previa) throw new ConflictException(noDisponible);
        throw new ConflictException(
          previa.estado === 1
            ? 'El usuario ya pertenece a la empresa'
            : 'El usuario ya existe. Reactiva su membresía.',
        );
      }
      await this.cupo(tx, org);
      usuario = await tx.usuario.create({
        data: {
          email,
          nombre: input.nombre,
          apellido: input.apellido,
          telefono: input.telefono,
          passwordHash,
          debeCambiarPassword: 1,
          usuarioCreacion: ctx.usuarioId,
        },
      });
      const m = await tx.organizacionUsuario.create({
        data: {
          organizacionId: org,
          usuarioId: usuario.id,
          rol: input.rol,
          usuarioCreacion: ctx.usuarioId,
        },
      });
      await this.evento(tx, org, usuario.id, ctx.usuarioId, 'CREAR', null, m);
      return { id: usuario.id };
    });
  }

  async cambiarEstadoCuentaPlataforma(
    usuarioId: string,
    estado: 0 | 1,
    actorId: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const actor = await tx.usuario.findUnique({ where: { id: actorId } });
        if (actor?.estado !== 1 || actor.esAdminPlataforma !== 1)
          throw new ForbiddenException('Solo plataforma');

        const membresias = await tx.organizacionUsuario.findMany({
          where: { usuarioId, estado: 1 },
          select: { organizacionId: true },
          orderBy: { organizacionId: 'asc' },
        });
        // El mismo orden que las altas/asignaciones: empresa antes de usuario.
        // La reactivación global también vuelve a consumir las plazas de sus
        // membresías activas, aunque estas nunca se hayan desactivado.
        for (const m of membresias)
          await this.bloquear(
            tx,
            `org-usuarios:${m.organizacionId.toLowerCase()}`,
          );
        await this.bloquear(tx, `usuario-empresa:${usuarioId.toLowerCase()}`);
        const usuario = await tx.usuario.findUnique({
          where: { id: usuarioId },
        });
        if (!usuario) throw new NotFoundException('Usuario no encontrado');
        if (
          estado === 1 &&
          usuario.estado !== 1 &&
          usuario.esAdminPlataforma !== 1
        ) {
          const actuales = await tx.organizacionUsuario.findMany({
            where: { usuarioId, estado: 1 },
            select: { organizacionId: true },
          });
          const bloqueadas = new Set(membresias.map((m) => m.organizacionId));
          for (const m of actuales) {
            if (!bloqueadas.has(m.organizacionId))
              throw new ConflictException(
                'La membresía cambió. Vuelve a intentarlo.',
              );
            await this.cupo(tx, m.organizacionId);
          }
        }

        return tx.usuario.update({
          where: { id: usuarioId },
          data: { estado, usuarioEdicion: actorId },
        });
      },
      { timeout: 20000 },
    );
  }

  async crearCuentaPlataforma(
    input: {
      email: string;
      nombre: string;
      apellido?: string;
      telefono?: string;
      password: string;
      esAdminPlataforma?: boolean;
      asignacion?: { organizacionId: string; rol: RolOrganizacion };
    },
    actorId: string,
  ) {
    const email = input.email.trim().toLowerCase();
    const passwordHash = await this.hasher.hash(input.password);
    const ctx: RequestContext = { usuarioId: actorId, esAdminPlataforma: true };
    const crear = async (tx: Tx, plataforma: boolean) => {
      if (!plataforma) throw new ForbiddenException('Solo plataforma');
      await this.bloquear(tx, `usuario-email:${email}`);
      const existente = await tx.usuario.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      });
      if (existente) throw await this.yaRegistrado(tx, existente.id);
      if (input.asignacion && !input.esAdminPlataforma)
        await this.cupo(tx, input.asignacion.organizacionId);
      const usuario = await tx.usuario.create({
        data: {
          email,
          nombre: input.nombre,
          apellido: input.apellido,
          telefono: input.telefono,
          passwordHash,
          esAdminPlataforma: input.esAdminPlataforma ? 1 : 0,
          usuarioCreacion: actorId,
        },
      });
      if (input.asignacion) {
        const { organizacionId, rol } = input.asignacion;
        const m = await tx.organizacionUsuario.create({
          data: {
            organizacionId,
            usuarioId: usuario.id,
            rol,
            usuarioCreacion: actorId,
          },
        });
        await this.evento(
          tx,
          organizacionId,
          usuario.id,
          actorId,
          'CREAR',
          null,
          m,
        );
      }
      return usuario;
    };
    if (input.asignacion)
      return this.ejecutar(input.asignacion.organizacionId, ctx, crear);
    return this.prisma.$transaction(async (tx) => {
      const actor = await tx.usuario.findUnique({ where: { id: actorId } });
      return crear(tx, actor?.estado === 1 && actor.esAdminPlataforma === 1);
    });
  }

  async asignar(
    org: string,
    usuarioId: string,
    rol: RolOrganizacion,
    ctx: RequestContext,
  ) {
    return this.ejecutar(org, ctx, async (tx, plataforma) => {
      await this.unaEmpresa(tx, org, usuarioId, plataforma);
      const usuario = await tx.usuario.findUnique({ where: { id: usuarioId } });
      if (!usuario || usuario.estado !== 1)
        throw new NotFoundException('Usuario no disponible');
      const antes = await tx.organizacionUsuario.findUnique({
        where: { organizacionId_usuarioId: { organizacionId: org, usuarioId } },
      });
      this.proteger(antes, rol, 1, ctx, plataforma);
      if (antes) await this.ultimoPropietario(tx, antes, rol, 1);
      if (antes?.estado !== 1 && usuario.esAdminPlataforma !== 1)
        await this.cupo(tx, org);
      const m = await tx.organizacionUsuario.upsert({
        where: { organizacionId_usuarioId: { organizacionId: org, usuarioId } },
        create: {
          organizacionId: org,
          usuarioId,
          rol,
          usuarioCreacion: ctx.usuarioId,
        },
        update: { rol, estado: 1, usuarioEdicion: ctx.usuarioId },
      });
      await this.evento(
        tx,
        org,
        usuarioId,
        ctx.usuarioId,
        antes ? 'ACTUALIZAR' : 'ASIGNAR',
        antes,
        m,
      );
      return { id: usuarioId };
    });
  }

  async editar(
    org: string,
    usuarioId: string,
    input: {
      nombre?: string;
      apellido?: string;
      telefono?: string;
      rol?: RolOrganizacion;
    },
    ctx: RequestContext,
  ) {
    return this.ejecutar(org, ctx, async (tx, plataforma) => {
      const m = await tx.organizacionUsuario.findUnique({
        where: { organizacionId_usuarioId: { organizacionId: org, usuarioId } },
      });
      if (!m) throw new NotFoundException('Usuario no encontrado');
      this.proteger(m, input.rol, undefined, ctx, plataforma);
      await this.protegerCuentaPlataforma(tx, usuarioId, plataforma);
      await this.unaEmpresa(tx, org, usuarioId);
      await this.ultimoPropietario(tx, m, input.rol);
      const { rol, ...datos } = input;
      await tx.usuario.update({
        where: { id: usuarioId },
        data: { ...datos, usuarioEdicion: ctx.usuarioId },
      });
      const despues = await tx.organizacionUsuario.update({
        where: { id: m.id },
        data: { rol, usuarioEdicion: ctx.usuarioId },
      });
      await this.evento(
        tx,
        org,
        usuarioId,
        ctx.usuarioId,
        'EDITAR',
        m,
        despues,
      );
      return { id: usuarioId };
    });
  }

  async cambiarEstado(
    org: string,
    usuarioId: string,
    estado: 0 | 1,
    ctx: RequestContext,
  ) {
    const resultado = await this.ejecutar(org, ctx, async (tx, plataforma) => {
      const m = await tx.organizacionUsuario.findUnique({
        where: { organizacionId_usuarioId: { organizacionId: org, usuarioId } },
      });
      if (!m) throw new NotFoundException('Usuario no encontrado');
      this.proteger(m, undefined, estado, ctx, plataforma);
      await this.protegerCuentaPlataforma(tx, usuarioId, plataforma);
      await this.ultimoPropietario(tx, m, undefined, estado);
      if (m.estado === estado) return { id: usuarioId, chats: [] };
      if (estado === 1) {
        await this.unaEmpresa(tx, org, usuarioId);
        const u = await tx.usuario.findUniqueOrThrow({
          where: { id: usuarioId },
        });
        if (u.estado !== 1)
          throw new ConflictException('La plataforma debe activar esta cuenta');
        if (u.esAdminPlataforma !== 1) await this.cupo(tx, org);
      }
      // Se bloquea el control antes de cambiar la membresía: un envío nuevo
      // revalida su estado bajo el mismo bloqueo de WhatsApp.
      const chats =
        estado === 0
          ? await this.control.liberarPorMembresia(
              tx,
              org,
              usuarioId,
              ctx.usuarioId,
            )
          : [];
      const nuevo = await tx.organizacionUsuario.update({
        where: { id: m.id },
        data: { estado, usuarioEdicion: ctx.usuarioId },
      });
      if (estado === 0) {
        const cfg = await tx.leadAutoAsignacionConfig.findUnique({
          where: { organizacionId: org },
        });
        if (cfg) {
          const ids = resolverUsuarioIdsRoundRobin(cfg).filter(
            (id) => id !== usuarioId,
          );
          await tx.leadAutoAsignacionConfig.update({
            where: { organizacionId: org },
            data: {
              usuarioIds: ids,
              siguienteIndice: 0,
              ...(!ids.length
                ? { habilitado: 0 }
                : {
                    usuarioPrimeroId: ids[0],
                    usuarioSegundoId: ids[1] ?? ids[0],
                  }),
            },
          });
        }
        if (
          !(await tx.organizacionUsuario.count({
            where: { usuarioId, estado: 1 },
          }))
        ) {
          const tokens = await tx.tokenRefresco.findMany({
            where: { usuarioId, estado: 1 },
          });
          for (const familia of [
            ...new Set(tokens.map((t) => t.familiaId ?? t.id)),
          ].sort())
            await this.bloquear(tx, `refresh:${familia}`);
          await tx.tokenRefresco.updateMany({
            where: { usuarioId, estado: 1 },
            data: { estado: 0, revocadoEn: new Date() },
          });
        }
      }
      await this.evento(
        tx,
        org,
        usuarioId,
        ctx.usuarioId,
        estado ? 'REACTIVAR' : 'DESACTIVAR',
        m,
        nuevo,
      );
      const leadsAsignados = await tx.lead.count({
        where: { organizacionId: org, asignadoUsuarioId: usuarioId, estado: 1 },
      });
      return { id: usuarioId, leadsAsignados, chats };
    });
    this.control.notificarLiberacionMembresia(resultado.chats);
    const { chats, ...respuesta } = resultado;
    return respuesta;
  }

  async passwordTemporal(
    org: string,
    usuarioId: string,
    password: string,
    ctx: RequestContext,
  ) {
    const passwordHash = await this.hasher.hash(password);
    return this.ejecutar(org, ctx, async (tx, plataforma) => {
      const m = await tx.organizacionUsuario.findUnique({
        where: { organizacionId_usuarioId: { organizacionId: org, usuarioId } },
      });
      if (!m) throw new NotFoundException('Usuario no encontrado');
      this.proteger(m, undefined, undefined, ctx, plataforma);
      await this.protegerCuentaPlataforma(tx, usuarioId, plataforma);
      if (usuarioId === ctx.usuarioId)
        throw new BadRequestException('Cambia tu contraseña desde tu perfil');
      await this.unaEmpresa(tx, org, usuarioId);
      await tx.usuario.update({
        where: { id: usuarioId },
        data: {
          passwordHash,
          debeCambiarPassword: 1,
          usuarioEdicion: ctx.usuarioId,
        },
      });
      await tx.tokenRefresco.updateMany({
        where: { usuarioId, estado: 1 },
        data: { estado: 0, revocadoEn: new Date() },
      });
      await this.evento(
        tx,
        org,
        usuarioId,
        ctx.usuarioId,
        'PASSWORD_TEMPORAL',
        m,
      );
      return { id: usuarioId };
    });
  }

  async reasignarLeads(
    org: string,
    origen: string,
    destino: string,
    ctx: RequestContext,
  ) {
    if (origen === destino)
      throw new BadRequestException('Selecciona otro usuario de destino');
    const resultado = await this.ejecutar(org, ctx, async (tx, plataforma) => {
      const fuente = await tx.organizacionUsuario.findUnique({
        where: {
          organizacionId_usuarioId: { organizacionId: org, usuarioId: origen },
        },
      });
      if (!fuente) throw new NotFoundException('Usuario no encontrado');
      this.proteger(fuente, undefined, undefined, ctx, plataforma);
      if (fuente.estado !== 0)
        throw new ConflictException('Desactiva primero al usuario de origen');
      const receptor = await tx.organizacionUsuario.findFirst({
        where: {
          organizacionId: org,
          usuarioId: destino,
          estado: 1,
          usuario: { estado: 1 },
        },
      });
      if (!receptor)
        throw new BadRequestException(
          'El destinatario debe ser un usuario activo de esta empresa',
        );
      const resultado = await tx.lead.updateMany({
        where: { organizacionId: org, asignadoUsuarioId: origen, estado: 1 },
        data: {
          asignadoUsuarioId: destino,
          asignadoEn: new Date(),
          asignadoPorUsuarioId: ctx.usuarioId,
          usuarioEdicion: ctx.usuarioId,
        },
      });
      await this.evento(
        tx,
        org,
        origen,
        ctx.usuarioId,
        'REASIGNAR_LEADS',
        fuente,
      );
      return { reasignados: resultado.count };
    });
    // Mismo punto de entrada de notificaciones que AsignarLeadUseCase;
    // solo después del commit y una notificación por lote, nunca por lead.
    // El historial de estados existente no registra asignaciones individuales.
    if (resultado.reasignados > 0) {
      await this.notificar
        .execute({
          organizacionId: org,
          tipo: 'LEAD_ASIGNADO',
          titulo: 'Leads reasignados',
          mensaje: `Se te reasignaron ${resultado.reasignados} leads`,
          payload: {
            url: '/leads',
            cantidad: resultado.reasignados,
            origenUsuarioId: origen,
          },
          usuarioIds: [destino],
        })
        .catch(() =>
          this.logger.warn(
            'Leads reasignados; no se pudo notificar al destinatario',
          ),
        );
    }
    return resultado;
  }
}
