import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TokenEncryptionService } from './token-encryption.service';

export type IntegracionInput = {
  webhookUrl: string;
  headerNombre: string;
  version: number;
  secreto?: string;
  eliminarSecreto?: boolean;
};

@Injectable()
export class AutomatizacionesIntegracionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cifrado: TokenEncryptionService,
  ) {}
  async estado() {
    const c = await this.prisma.automatizacionIntegracion.findUnique({
      where: { id: 'n8n' },
    });
    return {
      proveedor: 'n8n',
      alcance: 'PLATAFORMA',
      configurada: !!c?.webhookUrl && !!c.secretoCifrado,
      operativa: false,
      estado: 'PENDIENTE_ORQUESTACION',
    };
  }
  async obtener() {
    const c = await this.prisma.automatizacionIntegracion.findUnique({
      where: { id: 'n8n' },
    });
    return {
      webhookUrl: c?.webhookUrl ?? '',
      headerNombre: c?.headerNombre ?? 'X-CRM-Secret',
      version: c?.version ?? 0,
      credencialConfigurada: !!c?.secretoCifrado,
      configurada: !!c?.webhookUrl && !!c.secretoCifrado,
      operativa: false,
      actualizadoEn: c?.actualizadoEn ?? null,
    };
  }
  async guardar(usuarioId: string, input: IntegracionInput) {
    let url: URL;
    try {
      url = new URL(input.webhookUrl.trim());
    } catch {
      throw new BadRequestException('URL n8n inválida');
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new BadRequestException(
        'Usa una URL HTTP/HTTPS sin credenciales, parámetros ni fragmento',
      );
    if (
      !/^[A-Za-z0-9-]{1,100}$/.test(input.headerNombre) ||
      ['host', 'cookie', 'content-length', 'content-type'].includes(
        input.headerNombre.toLowerCase(),
      )
    )
      throw new BadRequestException('Nombre de cabecera inválido');
    if (
      input.secreto !== undefined &&
      (input.secreto.length < 16 ||
        input.secreto.length > 4096 ||
        /[\r\n]/.test(input.secreto))
    )
      throw new BadRequestException(
        'El secreto debe tener entre 16 y 4096 caracteres, sin saltos de línea',
      );
    if (input.eliminarSecreto && input.secreto !== undefined)
      throw new BadRequestException('Elige reemplazar o eliminar el secreto');
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('crm:n8n:plataforma',0))::text`;
      const admin = await tx.usuario.findFirst({
        where: { id: usuarioId, estado: 1, esAdminPlataforma: 1 },
      });
      if (!admin)
        throw new ForbiddenException(
          'Solo la administración de plataforma puede editar n8n',
        );
      const actual = await tx.automatizacionIntegracion.findUnique({
        where: { id: 'n8n' },
      });
      if ((actual?.version ?? 0) !== input.version)
        throw new ConflictException(
          'La conexión cambió; actualiza antes de guardar',
        );
      const secretoCifrado = input.eliminarSecreto
        ? null
        : input.secreto !== undefined
          ? this.cifrado.encrypt(input.secreto)
          : (actual?.secretoCifrado ?? null);
      const data = {
        webhookUrl: url.toString(),
        headerNombre: input.headerNombre,
        secretoCifrado,
        actualizadoPor: usuarioId,
        version: input.version + 1,
      };
      await tx.automatizacionIntegracion.upsert({
        where: { id: 'n8n' },
        create: { id: 'n8n', ...data },
        update: data,
      });
      await tx.automatizacionIntegracionEvento.create({
        data: {
          version: data.version,
          usuarioId,
          secretoAccion: input.eliminarSecreto
            ? 'ELIMINADO'
            : input.secreto !== undefined
              ? 'REEMPLAZADO'
              : 'CONSERVADO',
        },
      });
    });
    return this.obtener();
  }
}
