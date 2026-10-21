import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { lockBotOrganizacion } from '../../whatsapp/messaging/application/bot-organizacion-lock';

@Injectable()
export class WhatsappBotAdminService {
  constructor(private readonly prisma: PrismaService) {}

  private async autorizar(
    tx: Prisma.TransactionClient,
    org: string,
    usuarioId: string,
  ) {
    const admin = await tx.usuario.findFirst({
      where: { id: usuarioId, estado: 1, esAdminPlataforma: 1 },
    });
    if (!admin)
      throw new ForbiddenException(
        'Requiere permisos de administrador de plataforma',
      );
    const organizacion = await tx.organizacion.findUnique({
      where: { id: org },
    });
    if (!organizacion)
      throw new NotFoundException('Organización no encontrada');
    return organizacion;
  }

  private async estado(tx: Prisma.TransactionClient, org: string) {
    const config = await tx.whatsappBotConfiguracion.findUnique({
      where: { organizacionId: org },
    });
    const despachosEnCurso = await tx.whatsappSalidaIntento.count({
      where: { organizacionId: org, actor: 'BOT', estado: 'DESPACHANDO' },
    });
    return {
      organizacionId: org,
      habilitado: config?.habilitado ?? false,
      configVersion: config?.version ?? 0,
      actualizadoEn: config?.actualizadoEn ?? null,
      actualizadoPor: config?.actualizadoPor ?? null,
      despachosEnCurso,
      desactivacionPendiente:
        !(config?.habilitado ?? false) && despachosEnCurso > 0,
    };
  }

  async obtener(org: string, usuarioId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await lockBotOrganizacion(tx, org);
        await this.autorizar(tx, org, usuarioId);
        return this.estado(tx, org);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async actualizar(
    org: string,
    usuarioId: string,
    input: { habilitado: boolean; configVersion: number; motivo: string },
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await lockBotOrganizacion(tx, org);
        const organizacion = await this.autorizar(tx, org, usuarioId);
        const anterior = await this.estado(tx, org);
        if (input.configVersion !== anterior.configVersion)
          throw new ConflictException(
            'La configuración cambió; consulta su versión actual',
          );
        if (input.habilitado) {
          if (organizacion.estado !== 1)
            throw new ConflictException('La organización está desactivada');
          const modulo = await tx.organizacionModulo.findFirst({
            where: {
              organizacionId: org,
              estado: 1,
              habilitado: 1,
              modulo: { codigo: 'WHATSAPP', estado: 1, grupo: { estado: 1 } },
            },
          });
          if (!modulo)
            throw new ConflictException(
              'La organización debe tener el módulo WHATSAPP habilitado',
            );
          const automatizaciones = await tx.organizacionModulo.findFirst({
            where: {
              organizacionId: org,
              estado: 1,
              habilitado: 1,
              modulo: {
                codigo: 'AUTOMATIZACIONES',
                estado: 1,
                grupo: { estado: 1 },
              },
            },
          });
          if (!automatizaciones)
            throw new ConflictException(
              'Habilita el módulo Automatizaciones antes de autorizar el bot',
            );
          if (!anterior.habilitado && anterior.despachosEnCurso > 0)
            throw new ConflictException(
              'La desactivación anterior todavía tiene envíos en curso',
            );
        }
        if (input.habilitado === anterior.habilitado) return anterior;
        const config = await tx.whatsappBotConfiguracion.upsert({
          where: { organizacionId: org },
          create: {
            organizacionId: org,
            habilitado: input.habilitado,
            version: 1,
            actualizadoPor: usuarioId,
            actualizadoEn: new Date(),
          },
          update: {
            habilitado: input.habilitado,
            version: { increment: 1 },
            actualizadoPor: usuarioId,
            actualizadoEn: new Date(),
          },
        });
        await tx.whatsappBotConfiguracionEvento.create({
          data: {
            organizacionId: org,
            usuarioId,
            version: config.version,
            habilitadoAnterior: anterior.habilitado,
            habilitadoNuevo: config.habilitado,
            motivo: input.motivo.trim(),
          },
        });
        // No actualizar conversaciones: activar una empresa nunca retoma chats humanos.
        // La versión invalida propuestas antiguas incluso después de desactivar/reactivar.
        return this.estado(tx, org);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async historial(org: string, usuarioId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.autorizar(tx, org, usuarioId);
      const eventos = await tx.whatsappBotConfiguracionEvento.findMany({
        where: { organizacionId: org },
        orderBy: { version: 'desc' },
        take: 100,
      });
      const ids = [...new Set(eventos.map((e) => e.usuarioId))];
      const usuarios = ids.length
        ? await tx.usuario.findMany({
            where: { id: { in: ids } },
            select: { id: true, nombre: true, apellido: true },
          })
        : [];
      return eventos.map((e) => ({
        ...e,
        usuario: usuarios.find((u) => u.id === e.usuarioId) ?? null,
      }));
    });
  }
}
