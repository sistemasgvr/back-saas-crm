import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  BeforeApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
export class HttpAuditService
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private readonly logger = new Logger(HttpAuditService.name);
  private readonly pendientes: Prisma.RegistroHttpCreateManyInput[] = [];
  private escritura?: Promise<void>;
  private limpieza?: Promise<void>;
  private intervalos: NodeJS.Timeout[] = [];
  private colaLlenaAvisada = false;
  readonly habilitado: boolean;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.habilitado = config.get<boolean>('HTTP_AUDIT_ENABLED', true);
  }

  onApplicationBootstrap() {
    if (!this.habilitado) return;
    this.intervalos = [
      setInterval(() => void this.flush(), 1000),
      setInterval(() => void this.limpiar(), 60 * 60 * 1000),
    ];
    this.intervalos.forEach((timer) => timer.unref());
    void this.limpiar();
  }

  registrar(registro: Prisma.RegistroHttpCreateManyInput) {
    if (!this.habilitado) return;
    // Cola acotada: una caída de BD no debe agotar la memoria de la API.
    if (this.pendientes.length >= 5000) {
      if (!this.colaLlenaAvisada) {
        this.colaLlenaAvisada = true;
        this.logger.warn(
          'Auditoría HTTP: cola llena; se descartan registros nuevos',
        );
        // No aumentar la cola ni publicar datos de la solicitud.
      }
      return;
    }
    this.pendientes.push(registro);
    if (this.pendientes.length >= 100) void this.flush();
  }

  flush(): Promise<void> {
    if (this.escritura) return this.escritura;
    if (!this.pendientes.length) return Promise.resolve();
    const lote = this.pendientes.splice(0, 100);
    this.escritura = (async () => {
      try {
        await this.prisma.registroHttp.createMany({
          data: lote,
          skipDuplicates: true,
        });
        this.colaLlenaAvisada = false;
      } catch {
        // UUID estable + skipDuplicates: un resultado de commit ambiguo no duplica filas.
        this.pendientes.unshift(...lote);
        this.pendientes.splice(5000);
        this.logger.warn(
          'Auditoría HTTP: persistencia no disponible; se reintentará',
        );
      }
    })().finally(() => {
      this.escritura = undefined;
    });
    return this.escritura;
  }

  limpiar(): Promise<void> {
    if (this.limpieza) return this.limpieza;
    const limite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    this.limpieza = (async () => {
      try {
        // Transacción y lock para coordinar réplicas. Trabajo acotado por ejecución.
        await this.prisma.$transaction(
          async (tx) => {
            const [lock] = await tx.$queryRaw<{ adquirido: boolean }[]>`
            SELECT pg_try_advisory_xact_lock(20261124, 30) AS adquirido`;
            if (!lock?.adquirido) return;
            for (let i = 0; i < 20; i++) {
              const borrados = await tx.$executeRaw`
              DELETE FROM registros_http WHERE id IN (
                SELECT id FROM registros_http WHERE fecha < ${limite}
                ORDER BY fecha LIMIT 1000
              )`;
              if (borrados < 1000) break;
            }
          },
          { timeout: 15000 },
        );
      } catch {
        this.logger.warn(
          'Auditoría HTTP: limpieza pendiente; se reintentará automáticamente',
        );
      }
    })().finally(() => {
      this.limpieza = undefined;
    });
    return this.limpieza;
  }

  async beforeApplicationShutdown() {
    this.intervalos.forEach(clearInterval);
    await this.escritura;
    // No bloquear indefinidamente un apagado si la BD no responde.
    for (let i = 0; i < 50 && this.pendientes.length; i++) {
      const antes = this.pendientes.length;
      await this.flush();
      if (this.pendientes.length >= antes) break;
    }
    await this.limpieza;
    if (this.pendientes.length)
      this.logger.warn(
        `Auditoría HTTP: ${this.pendientes.length} registros sin persistir al apagar`,
      );
  }
}
