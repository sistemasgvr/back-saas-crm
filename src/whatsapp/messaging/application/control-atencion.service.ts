import { lockBotOrganizacion } from './bot-organizacion-lock';
import { BotEmpresaService } from './bot-empresa.service';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WhatsappConversacion } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import {
  WS_EMITTER,
  type WsEmitter,
} from '../../../notifications/application/ports/ws-emitter.port';
import type { RolOrganizacion } from '../../../auth/domain/request-context.interface';
import { puedeEscribirConversacionWhatsApp } from '../domain/acceso-conversacion-whatsapp';
import { esRechazoMeta } from '../../../meta/connections/application/mapear-error-meta-graph';

export type ActorSalida =
  | { tipo: 'HUMAN'; usuarioId: string; rol: RolOrganizacion }
  | {
      tipo: 'BOT';
      configVersion: number;
      controlVersion: number;
      entradaRevision: number;
      clave: string;
    }
  | { tipo: 'SYSTEM'; origen: 'agenda_recordatorio' };
type ContextoHumano = { usuarioId: string; rol: RolOrganizacion };

/** Coordinación persistente entre réplicas. Ninguna transacción permanece
 * abierta durante llamadas a Meta. Un intento DESPACHANDO nunca vence por TTL:
 * si cae el proceso, se bloquea la confirmación hasta reconciliarlo. */
@Injectable()
export class ControlAtencionService {
  private readonly logger = new Logger(ControlAtencionService.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WS_EMITTER) private readonly ws: WsEmitter,
    private readonly bot: BotEmpresaService,
  ) {}

  private async exclusiva<T>(
    org: string,
    id: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        await lockBotOrganizacion(tx, org);
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${org.toLowerCase() + ':' + id.toLowerCase()}, 0))::text`;
        return fn(tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  private async conversacion(
    tx: Prisma.TransactionClient,
    org: string,
    id: string,
  ) {
    const c = await tx.whatsappConversacion.findFirst({
      where: { id, organizacionId: org, estado: 1 },
      include: { lead: true },
    });
    if (!c) throw new NotFoundException('Conversación no encontrada');
    return c;
  }

  private async autorizar(
    tx: Prisma.TransactionClient,
    c: WhatsappConversacion & {
      lead: { asignadoUsuarioId: string | null } | null;
    },
    ctx: ContextoHumano,
  ) {
    const miembro = await tx.organizacionUsuario.findFirst({
      where: {
        organizacionId: c.organizacionId,
        usuarioId: ctx.usuarioId,
        estado: 1,
        organizacion: { estado: 1 },
        usuario: { estado: 1 },
      },
    });
    const actual = { ...ctx, rol: miembro?.rol as RolOrganizacion };
    if (!miembro || !puedeEscribirConversacionWhatsApp(c.lead, actual))
      throw new ForbiddenException(
        'No tienes permiso para tomar esta conversación',
      );
    const admin = ['PROPIETARIO', 'ADMINISTRADOR'].includes(miembro.rol);
    // El asignado del lead puede retomar su chat (reasignación o intervención
    // de un administrador) sin esperar una transferencia manual.
    const asignado = c.lead?.asignadoUsuarioId === ctx.usuarioId;
    if (
      c.controlUsuarioId &&
      c.controlUsuarioId !== ctx.usuarioId &&
      !admin &&
      !asignado
    )
      throw new ConflictException(
        'Otro asesor tiene el control; solicita una transferencia',
      );
    return admin;
  }

  async asumirHumano(
    org: string,
    id: string,
    ctx: ContextoHumano,
    version: number,
    asignadoEsperado: string | null,
  ) {
    const c = await this.exclusiva(org, id, async (tx) => {
      const actual = await this.conversacion(tx, org, id);
      await this.autorizar(tx, actual, ctx);
      if (
        !['MANUAL', 'HUMANO_ACTIVO'].includes(actual.modoAtencion) ||
        actual.controlVersion !== version ||
        (actual.lead?.asignadoUsuarioId ?? null) !== asignadoEsperado
      )
        throw new ConflictException(
          'La atención o asignación cambió; actualiza el chat',
        );
      const pendientes = await tx.whatsappSalidaIntento.count({
        where: {
          organizacionId: org,
          conversacionId: id,
          actor: { in: ['HUMAN', 'BOT'] },
          estado: 'DESPACHANDO',
        },
      });
      if (pendientes)
        throw new ConflictException(
          'Espera a que terminen los envíos anteriores',
        );
      if (actual.leadId && actual.lead?.asignadoUsuarioId !== ctx.usuarioId) {
        const cambio = await tx.lead.updateMany({
          where: {
            id: actual.leadId,
            organizacionId: org,
            estado: 1,
            asignadoUsuarioId: asignadoEsperado,
          },
          data: {
            asignadoUsuarioId: ctx.usuarioId,
            asignadoEn: new Date(),
            asignadoPorUsuarioId: asignadoEsperado ? ctx.usuarioId : null,
            usuarioEdicion: ctx.usuarioId,
          },
        });
        if (cambio.count !== 1)
          throw new ConflictException(
            'La asignación cambió; actualiza el chat',
          );
      }
      const cambio = await tx.whatsappConversacion.updateMany({
        where: {
          id,
          organizacionId: org,
          leadId: actual.leadId,
          controlVersion: version,
        },
        data: {
          modoAtencion: 'HUMANO_ACTIVO',
          controlVersion: { increment: 1 },
          controlUsuarioId: ctx.usuarioId,
          controlSolicitadoEn: new Date(),
          controlTomadoEn: new Date(),
          controlMotivo: 'toma_chat_humano',
        },
      });
      if (cambio.count !== 1)
        throw new ConflictException(
          'La conversación cambió; actualiza el chat',
        );
      const nuevo = await this.conversacion(tx, org, id);
      await this.auditar(tx, nuevo, 'toma_chat_humano', 'HUMAN', ctx.usuarioId);
      return nuevo;
    });
    this.emitir(c);
    return this.estado(org, id);
  }

  async asignarBot(
    org: string,
    id: string,
    ctx: ContextoHumano,
    version: number,
  ) {
    const c = await this.exclusiva(org, id, async (tx) => {
      const actual = await this.conversacion(tx, org, id);
      await this.autorizar(tx, actual, ctx);
      if (actual.controlVersion !== version)
        throw new ConflictException(
          'El control cambió; actualiza la conversación',
        );
      await this.bot.requiereBot(tx, org);
      if (actual.bloqueado || actual.modoAtencion === 'TOMANDO_CONTROL')
        throw new ConflictException(
          'No se puede asignar el bot mientras el contacto esté bloqueado o la toma pendiente',
        );
      const pendientes = await tx.whatsappSalidaIntento.count({
        where: {
          organizacionId: org,
          conversacionId: id,
          actor: { in: ['HUMAN', 'BOT'] },
          estado: 'DESPACHANDO',
        },
      });
      if (pendientes)
        throw new ConflictException(
          'Espera a que terminen los envíos anteriores',
        );
      if (actual.modoAtencion === 'BOT_ACTIVO') return actual;
      const nuevo = await tx.whatsappConversacion.update({
        where: { id },
        data: {
          modoAtencion: 'BOT_ACTIVO',
          controlVersion: { increment: 1 },
          controlUsuarioId: null,
          controlSolicitadoEn: null,
          controlTomadoEn: null,
          controlMotivo: 'asignacion_bot_explicita',
        },
      });
      await this.auditar(
        tx,
        nuevo,
        'asignacion_bot_explicita',
        'HUMAN',
        ctx.usuarioId,
      );
      return nuevo;
    });
    this.emitir(c);
    return this.estado(org, id);
  }

  async aplicarModoInicial(org: string, id: string) {
    if (!(await this.bot.integracion()).operativa) return;
    const c = await this.exclusiva(org, id, async (tx) => {
      const actual = await this.conversacion(tx, org, id);
      if (
        actual.modoAtencion !== 'MANUAL' ||
        actual.controlVersion !== 0 ||
        actual.controlUsuarioId ||
        actual.bloqueado
      )
        return null;
      const d = await this.bot.disponibilidad(tx, org);
      if (!d.autorizado || d.config?.modoInicial !== 'BOT') return null;
      const nuevo = await tx.whatsappConversacion.update({
        where: { id },
        data: {
          modoAtencion: 'BOT_ACTIVO',
          controlVersion: { increment: 1 },
          controlMotivo: 'modo_inicial_empresa',
        },
      });
      await this.auditar(tx, nuevo, 'modo_inicial_empresa', 'SYSTEM');
      return nuevo;
    });
    if (c) this.emitir(c);
  }

  private async auditar(
    tx: Prisma.TransactionClient,
    c: WhatsappConversacion,
    motivo: string,
    actor: string,
    usuarioId?: string,
    wamid?: string,
  ) {
    await tx.whatsappControlEvento.create({
      data: {
        organizacionId: c.organizacionId,
        conversacionId: c.id,
        version: c.controlVersion,
        modo: c.modoAtencion,
        motivo,
        actor,
        usuarioId,
        wamid,
        responsableId: c.controlUsuarioId,
      },
    });
  }

  private emitir(c: WhatsappConversacion) {
    try {
      this.ws.emitirAOrganizacion(c.organizacionId, 'whatsapp:control', {
        conversacionId: c.id,
        controlVersion: c.controlVersion,
      });
    } catch {
      this.logger.warn(
        'Control persistido; no se pudo emitir actualización del socket',
      );
    }
  }

  private async confirmar(
    tx: Prisma.TransactionClient,
    c: WhatsappConversacion,
  ) {
    if (c.modoAtencion !== 'TOMANDO_CONTROL') return c;
    const activo = await tx.whatsappSalidaIntento.count({
      where: {
        organizacionId: c.organizacionId,
        conversacionId: c.id,
        actor: 'BOT',
        estado: 'DESPACHANDO',
      },
    });
    if (activo) return c;
    const nuevo = await tx.whatsappConversacion.update({
      where: { id: c.id },
      data: {
        modoAtencion: 'HUMANO_ACTIVO',
        controlTomadoEn: new Date(),
        controlVersion: { increment: 1 },
      },
    });
    await this.auditar(tx, nuevo, 'toma_confirmada', 'SYSTEM');
    return nuevo;
  }

  async estado(org: string, id: string) {
    const resultado = await this.exclusiva(org, id, async (tx) => {
      const anterior = await this.conversacion(tx, org, id);
      const actual = await this.confirmar(tx, anterior);
      return {
        actual,
        cambio: actual.controlVersion !== anterior.controlVersion,
      };
    });
    const c = resultado.actual;
    if (resultado.cambio) this.emitir(c);
    const responsable = c.controlUsuarioId
      ? await this.prisma.usuario.findUnique({
          where: { id: c.controlUsuarioId },
          select: { id: true, nombre: true, apellido: true },
        })
      : null;
    const intentos = await this.prisma.whatsappSalidaIntento.findMany({
      where: {
        organizacionId: org,
        conversacionId: id,
        OR: [
          { estado: { in: ['DESPACHANDO', 'INCIERTO'] } },
          { estado: 'ACEPTADO', mensajePersistido: false },
        ],
      },
      select: {
        id: true,
        actor: true,
        estado: true,
        creadoEn: true,
        wamid: true,
        mensajePersistido: true,
      },
      orderBy: { creadoEn: 'desc' },
      take: 20,
    });
    return {
      modoAtencion: c.modoAtencion,
      controlVersion: c.controlVersion,
      entradaRevision: c.entradaRevision,
      controlUsuarioId: c.controlUsuarioId,
      responsable,
      controlSolicitadoEn: c.controlSolicitadoEn,
      controlTomadoEn: c.controlTomadoEn,
      controlMotivo: c.controlMotivo,
      intentos,
    };
  }

  async historial(org: string, id: string) {
    await this.conversacion(this.prisma, org, id);
    const eventos = await this.prisma.whatsappControlEvento.findMany({
      where: { organizacionId: org, conversacionId: id },
      orderBy: { version: 'desc' },
      take: 100,
    });
    const ids = [
      ...new Set(
        eventos
          .flatMap((e) => [e.usuarioId, e.responsableId])
          .filter((v): v is string => !!v),
      ),
    ];
    const usuarios = ids.length
      ? await this.prisma.usuario.findMany({
          where: { id: { in: ids } },
          select: { id: true, nombre: true, apellido: true },
        })
      : [];
    return eventos.map((e) => ({
      ...e,
      usuario: usuarios.find((u) => u.id === e.usuarioId) ?? null,
      responsable: usuarios.find((u) => u.id === e.responsableId) ?? null,
    }));
  }

  async asesores(org: string, id: string, ctx: ContextoHumano) {
    return this.exclusiva(org, id, async (tx) => {
      const c = await this.conversacion(tx, org, id);
      await this.autorizar(tx, c, ctx);
      if (c.modoAtencion !== 'HUMANO_ACTIVO')
        throw new ConflictException(
          'Confirma la toma de control antes de transferir',
        );
      const miembros = await tx.organizacionUsuario.findMany({
        where: {
          organizacionId: org,
          estado: 1,
          usuario: { estado: 1 },
          organizacion: { estado: 1 },
        },
        select: {
          usuarioId: true,
          rol: true,
          usuario: { select: { id: true, nombre: true, apellido: true } },
        },
        orderBy: { usuario: { nombre: 'asc' } },
      });
      return miembros
        .filter(
          (m) =>
            m.usuarioId !== c.controlUsuarioId &&
            puedeEscribirConversacionWhatsApp(c.lead, {
              usuarioId: m.usuarioId,
              rol: m.rol as RolOrganizacion,
            }),
        )
        .map((m) => ({ ...m.usuario, rol: m.rol }));
    });
  }

  /** Uso interno del futuro gateway: derivar, pausar o cerrar nunca habilita
   * el bot ni sobreescribe una intervención humana. Sin endpoint de reanudación. */
  async detenerBot(
    org: string,
    id: string,
    destino: 'ESPERANDO_HUMANO' | 'PAUSADO' | 'CERRADO',
    motivo: string,
    version: number,
  ) {
    const c = await this.exclusiva(org, id, async (tx) => {
      const c = await this.conversacion(tx, org, id);
      if (c.controlVersion !== version || c.modoAtencion !== 'BOT_ACTIVO')
        throw new ConflictException('La atención automática ya cambió');
      const nuevo = await tx.whatsappConversacion.update({
        where: { id },
        data: {
          modoAtencion: destino,
          controlMotivo: motivo,
          controlVersion: { increment: 1 },
        },
      });
      await this.auditar(tx, nuevo, motivo, 'SYSTEM');
      return nuevo;
    });
    this.emitir(c);
    return this.estado(org, id);
  }

  async tomar(
    org: string,
    id: string,
    ctx: ContextoHumano,
    version?: number,
    motivo = 'toma_explicita',
  ) {
    const c = await this.exclusiva(org, id, async (tx) => {
      let c = await this.conversacion(tx, org, id);
      await this.autorizar(tx, c, ctx);
      if (version !== undefined && version !== c.controlVersion)
        throw new ConflictException(
          'El control cambió; actualiza la conversación',
        );
      if (
        c.modoAtencion === 'HUMANO_ACTIVO' &&
        c.controlUsuarioId === ctx.usuarioId
      )
        return c;
      if (
        c.modoAtencion !== 'TOMANDO_CONTROL' ||
        c.controlUsuarioId !== ctx.usuarioId
      ) {
        const actualizado = await tx.whatsappConversacion.update({
          where: { id },
          data: {
            modoAtencion: 'TOMANDO_CONTROL',
            controlUsuarioId: ctx.usuarioId,
            controlSolicitadoEn: new Date(),
            controlTomadoEn: null,
            controlMotivo: motivo,
            controlVersion: { increment: 1 },
          },
        });
        await this.auditar(tx, actualizado, motivo, 'HUMAN', ctx.usuarioId);
        c = { ...c, ...actualizado };
      }
      return this.confirmar(tx, c);
    });
    this.emitir(c);
    return this.estado(org, id);
  }

  async transferir(
    org: string,
    id: string,
    ctx: ContextoHumano,
    destino: string,
    version: number,
  ) {
    const c = await this.exclusiva(org, id, async (tx) => {
      const c = await this.conversacion(tx, org, id);
      await this.autorizar(tx, c, ctx);
      if (version !== c.controlVersion || c.modoAtencion !== 'HUMANO_ACTIVO')
        throw new ConflictException('Actualiza el control antes de transferir');
      const miembro = await tx.organizacionUsuario.findFirst({
        where: {
          organizacionId: org,
          usuarioId: destino,
          estado: 1,
          usuario: { estado: 1 },
        },
      });
      if (
        !miembro ||
        !puedeEscribirConversacionWhatsApp(c.lead, {
          usuarioId: destino,
          rol: miembro.rol as RolOrganizacion,
        })
      )
        throw new ForbiddenException(
          'El destinatario debe tener permiso de escritura sobre el lead',
        );
      const nuevo = await tx.whatsappConversacion.update({
        where: { id },
        data: {
          controlUsuarioId: destino,
          controlMotivo: 'transferencia',
          controlVersion: { increment: 1 },
        },
      });
      await this.auditar(tx, nuevo, 'transferencia', 'HUMAN', ctx.usuarioId);
      return nuevo;
    });
    this.emitir(c);
    return this.estado(org, id);
  }

  async ecoExterno(org: string, id: string, wamid: string, historial: boolean) {
    if (historial) return 'UNKNOWN';
    const c = await this.exclusiva(org, id, async (tx) => {
      const conocido = await tx.whatsappMensaje.findUnique({
        where: { organizacionId_wamid: { organizacionId: org, wamid } },
      });
      if (conocido) return null;
      const intento = await tx.whatsappSalidaIntento.findFirst({
        where: { organizacionId: org, conversacionId: id, wamid },
      });
      if (intento) return null;
      const c = await this.conversacion(tx, org, id);
      const observado = await tx.whatsappControlEvento.findUnique({
        where: { organizacionId_wamid: { organizacionId: org, wamid } },
      });
      if (observado) {
        if (observado.conversacionId !== c.id)
          throw new ConflictException('Eco registrado en otra conversación');
        return { c, autor: observado.actor };
      }
      // Eco desconocido durante un envío: atribución incierta; pausar por
      // seguridad, sin afirmar que fue un humano. Nunca reanudar solo.
      const ambiguo = await tx.whatsappSalidaIntento.count({
        where: {
          organizacionId: org,
          conversacionId: id,
          estado: { in: ['DESPACHANDO', 'INCIERTO'] },
        },
      });
      const nuevo = await tx.whatsappConversacion.update({
        where: { id },
        data: {
          modoAtencion:
            c.modoAtencion === 'HUMANO_ACTIVO'
              ? 'HUMANO_ACTIVO'
              : 'TOMANDO_CONTROL',
          controlSolicitadoEn: c.controlSolicitadoEn ?? new Date(),
          controlMotivo: ambiguo ? 'eco_no_atribuido' : 'respuesta_externa',
          controlVersion: { increment: 1 },
        },
      });
      await this.auditar(
        tx,
        nuevo,
        nuevo.controlMotivo!,
        ambiguo ? 'UNKNOWN' : 'EXTERNAL',
        undefined,
        wamid,
      );
      return {
        c: await this.confirmar(tx, nuevo),
        autor: ambiguo ? 'UNKNOWN' : 'EXTERNAL',
      };
    });
    if (c) this.emitir(c.c);
    return c?.autor ?? 'UNKNOWN';
  }

  /** La función debe iniciar UNA petición inmediatamente; preparación de
   * archivos/contexto se hace antes. Cada parte de un lote cruza esta barrera.
   * `registraMensaje: false` para salidas que no crean fila de mensaje
   * (reacciones, solicitud de permiso de llamada): no quedan "pendientes". */
  async despachar<T>(
    org: string,
    id: string,
    actor: ActorSalida,
    tipo: string,
    enviar: () => Promise<T>,
    { registraMensaje = true }: { registraMensaje?: boolean } = {},
  ): Promise<T> {
    if (actor.tipo === 'HUMAN') {
      const c = await this.tomar(
        org,
        id,
        actor,
        undefined,
        'primer_envio_humano',
      );
      if (c.modoAtencion !== 'HUMANO_ACTIVO')
        throw new ConflictException(
          'Tomando control: espera a que termine el envío en curso',
        );
    }
    const intento = await this.exclusiva(org, id, async (tx) => {
      const c = await this.conversacion(tx, org, id);
      if (c.bloqueado)
        throw new ForbiddenException('El contacto está bloqueado');
      if (actor.tipo === 'HUMAN') {
        await this.autorizar(tx, c, actor);
        if (
          c.modoAtencion !== 'HUMANO_ACTIVO' ||
          c.controlUsuarioId !== actor.usuarioId
        )
          throw new ConflictException('El responsable cambió antes de enviar');
      }
      if (actor.tipo === 'BOT') {
        await this.bot.requiereBot(tx, org);
        const config = await tx.whatsappBotConfiguracion.findUnique({
          where: { organizacionId: org },
        });
        const modulo = await tx.organizacionModulo.findFirst({
          where: {
            organizacionId: org,
            estado: 1,
            habilitado: 1,
            modulo: { codigo: 'WHATSAPP', estado: 1 },
          },
        });
        const automatizaciones = await tx.organizacionModulo.findFirst({
          where: {
            organizacionId: org,
            estado: 1,
            habilitado: 1,
            modulo: { codigo: 'AUTOMATIZACIONES', estado: 1 },
          },
        });
        if (
          !modulo ||
          !automatizaciones ||
          !config?.habilitado ||
          config.version !== actor.configVersion ||
          c.modoAtencion !== 'BOT_ACTIVO' ||
          c.controlVersion !== actor.controlVersion ||
          c.entradaRevision !== actor.entradaRevision
        )
          throw new ConflictException(
            'Salida del bot invalidada por el control o un nuevo mensaje',
          );
      }
      if (
        tipo !== 'enviarMensajePlantillaWhatsApp' &&
        (!c.ventanaExpiraEn || c.ventanaExpiraEn.getTime() <= Date.now())
      )
        throw new ConflictException('Ventana de WhatsApp expirada');
      const linea = await tx.whatsappConexion.findFirst({
        where: {
          id: c.whatsappConexionId,
          organizacionId: org,
          estado: 1,
          organizacion: { estado: 1 },
          metaConexion: { estado: 1, organizacionId: org },
        },
      });
      if (!linea)
        throw new ForbiddenException(
          'La línea de la conversación no está activa',
        );
      if (actor.tipo === 'BOT') {
        const anterior = await tx.whatsappSalidaIntento.findUnique({
          where: {
            organizacionId_clave: { organizacionId: org, clave: actor.clave },
          },
        });
        if (anterior)
          throw new ConflictException(
            'La salida ya se intentó; no se reenvía automáticamente',
          );
      }
      return tx.whatsappSalidaIntento.create({
        data: {
          organizacionId: org,
          conversacionId: id,
          actor: actor.tipo,
          usuarioId: actor.tipo === 'HUMAN' ? actor.usuarioId : null,
          clave: actor.tipo === 'BOT' ? actor.clave : randomUUID(),
          tipo,
          controlVersion: c.controlVersion,
          estado: 'DESPACHANDO',
        },
      });
    });
    let resultado: T;
    try {
      resultado = await enviar();
    } catch (error) {
      if (esRechazoMeta(error)) {
        // Meta respondió con error: no se entregó; se muestra su motivo real.
        await this.prisma.whatsappSalidaIntento.update({
          where: { id: intento.id },
          data: { estado: 'RECHAZADO', terminadoEn: new Date() },
        });
        await this.finalizarToma(org, id);
        throw error;
      }
      // Timeout, desconexión o error de proveedor no prueban que no entregó.
      await this.prisma.whatsappSalidaIntento.update({
        where: { id: intento.id },
        data: { estado: 'INCIERTO', terminadoEn: new Date() },
      });
      await this.finalizarToma(org, id);
      throw new ConflictException(
        'Envío incierto; comprueba la conversación antes de reenviar',
      );
    }
    const wamid = (resultado as { wamid?: string } | undefined)?.wamid;
    // Si falla esta persistencia, permanece DESPACHANDO: fallo cerrado.
    await this.exclusiva(org, id, async (tx) => {
      const mensaje = wamid
        ? await tx.whatsappMensaje.updateMany({
            where: { organizacionId: org, whatsappConversacionId: id, wamid },
            data: {
              autorTipo: actor.tipo,
              usuarioCreacion: actor.tipo === 'HUMAN' ? actor.usuarioId : null,
            },
          })
        : { count: 0 };
      await tx.whatsappSalidaIntento.update({
        where: { id: intento.id },
        data: {
          estado: 'ACEPTADO',
          wamid,
          mensajePersistido: !registraMensaje || !wamid || mensaje.count > 0,
          terminadoEn: new Date(),
        },
      });
    });
    await this.finalizarToma(org, id);
    return resultado;
  }

  private async finalizarToma(org: string, id: string) {
    const c = await this.exclusiva(org, id, async (tx) =>
      this.confirmar(tx, await this.conversacion(tx, org, id)),
    );
    if (c.modoAtencion === 'HUMANO_ACTIVO') this.emitir(c);
  }
}
