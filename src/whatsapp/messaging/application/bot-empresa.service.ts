import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AutomatizacionesIntegracionService } from '../../../shared/infrastructure/automatizaciones-integracion.service';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import { lockBotOrganizacion } from './bot-organizacion-lock';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BotEmpresaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conexion: AutomatizacionesIntegracionService,
    private readonly config: ConfigService = new ConfigService(),
  ) {}

  integracion() {
    return this.conexion.estado();
  }

  async disponibilidad(tx: Prisma.TransactionClient, org: string) {
    const config = await tx.whatsappBotConfiguracion.findUnique({
      where: { organizacionId: org },
    });
    const codigos = await tx.organizacionModulo.findMany({
      where: {
        organizacionId: org,
        estado: 1,
        habilitado: 1,
        organizacion: { estado: 1 },
        modulo: {
          estado: 1,
          grupo: { estado: 1 },
          codigo: { in: ['WHATSAPP', 'AUTOMATIZACIONES'] },
        },
      },
      select: { modulo: { select: { codigo: true } } },
    });
    const whatsapp = codigos.some((m) => m.modulo.codigo === 'WHATSAPP');
    const automatizaciones = codigos.some(
      (m) => m.modulo.codigo === 'AUTOMATIZACIONES',
    );
    return {
      config,
      autorizado:
        this.clientesHabilitados() &&
        !!config?.habilitado &&
        whatsapp &&
        automatizaciones,
      whatsapp,
      automatizaciones,
    };
  }

  private clientesHabilitados() {
    const value = this.config.get<boolean | string>(
      'AUTOMATIZACIONES_CLIENTES_HABILITADAS',
    );
    return value === true || value === 'true';
  }

  async obtener(org: string) {
    const d = await this.disponibilidad(this.prisma, org);
    return {
      modoInicial: d.config?.modoInicial ?? 'HUMANO',
      preferenciasVersion: d.config?.preferenciasVersion ?? 0,
      autorizado: d.autorizado,
      clientesHabilitados: this.clientesHabilitados(),
      habilitadoPlataforma: d.config?.habilitado ?? false,
      automatizacionesHabilitado: d.automatizaciones,
      whatsappHabilitado: d.whatsapp,
      integracion: await this.integracion(),
    };
  }

  async actualizar(
    org: string,
    usuario: string,
    input: { modoInicial: 'HUMANO' | 'BOT'; preferenciasVersion: number },
  ) {
    await this.prisma.$transaction(async (tx) => {
      await lockBotOrganizacion(tx, org);
      const miembro = await tx.organizacionUsuario.findFirst({
        where: {
          organizacionId: org,
          usuarioId: usuario,
          estado: 1,
          organizacion: { estado: 1 },
          usuario: { estado: 1 },
        },
      });
      if (!miembro || !['PROPIETARIO', 'ADMINISTRADOR'].includes(miembro.rol))
        throw new ForbiddenException(
          'Solo el propietario o administrador puede configurar la atención',
        );
      const d = await this.disponibilidad(tx, org);
      if ((d.config?.preferenciasVersion ?? 0) !== input.preferenciasVersion)
        throw new ConflictException(
          'La preferencia cambió; actualiza la configuración',
        );
      if (input.modoInicial === 'BOT' && !d.autorizado)
        throw new ForbiddenException(
          'El bot requiere Automatizaciones, WhatsApp y autorización de la plataforma',
        );
      const anterior = d.config?.modoInicial ?? 'HUMANO';
      if (anterior === input.modoInicial) return;
      const data = {
        modoInicial: input.modoInicial,
        preferenciasActualizadoPor: usuario,
        preferenciasActualizadoEn: new Date(),
      };
      const nuevo = await tx.whatsappBotConfiguracion.upsert({
        where: { organizacionId: org },
        create: { organizacionId: org, ...data, preferenciasVersion: 1 },
        update: { ...data, preferenciasVersion: { increment: 1 } },
      });
      await tx.whatsappBotPreferenciaEvento.create({
        data: {
          organizacionId: org,
          usuarioId: usuario,
          version: nuevo.preferenciasVersion,
          modoAnterior: anterior,
          modoNuevo: input.modoInicial,
        },
      });
    });
    return this.obtener(org);
  }

  async requiereBot(tx: Prisma.TransactionClient, org: string) {
    const d = await this.disponibilidad(tx, org);
    if (!d.autorizado)
      throw new ForbiddenException(
        'El bot no está autorizado para esta empresa',
      );
    if (!(await this.integracion()).operativa)
      throw new ConflictException(
        'La atención automática aún no está conectada. Conserva la atención humana.',
      );
  }
}
