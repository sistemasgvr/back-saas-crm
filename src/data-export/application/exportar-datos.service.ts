import { createHash } from 'crypto';
import { once } from 'events';
import { extname } from 'path';
import { Readable, type Writable } from 'stream';
import { Inject, Injectable, Logger } from '@nestjs/common';
import archiver, { type Archiver } from 'archiver';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../shared/application/ports/object-storage.port';
import { CSV_BOM, filaCsv, formatearFecha } from './csv';
import {
  TABLAS_POR_SECCION,
  type SeccionExport,
  type TablaExport,
} from './tablas-export';

const LOTE = 1000;
const LOTE_MEDIOS = 200;

export interface OpcionesExport {
  organizacionId: string;
  usuarioId: string;
  secciones: readonly SeccionExport[];
  incluirMedios: boolean;
}

type Fila = Record<string, unknown>;

/** Firma mínima común a los delegates de Prisma que se exportan. */
interface DelegadoPaginable {
  findMany(args: {
    where: { organizacionId: string };
    select: Record<string, unknown>;
    orderBy: { id: 'asc' };
    take: number;
    cursor?: { id: string };
    skip?: number;
  }): Promise<Fila[]>;
}

const EXTENSIONES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/3gpp': '.3gp',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
  'audio/amr': '.amr',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
};

function extension(mime: string | null, nombreOriginal: string | null): string {
  const base = (mime ?? '').split(';')[0].trim().toLowerCase();
  if (EXTENSIONES[base]) return EXTENSIONES[base];
  const ext = nombreOriginal ? extname(nombreOriginal).toLowerCase() : '';
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : '.bin';
}

/**
 * Genera un ZIP con un CSV por tabla de las secciones elegidas y, si se pide,
 * los archivos de WhatsApp leídos desde el bucket (MinIO) más `chats/medios.csv`
 * que vincula cada mensaje con su archivo dentro del ZIP.
 *
 * Todo va en streaming y en orden: cada entrada se agrega cuando terminó la
 * anterior, así no se abren cientos de descargas de MinIO a la vez y la
 * memoria se mantiene acotada aunque la empresa tenga miles de archivos.
 */
@Injectable()
export class ExportarDatosService {
  private readonly logger = new Logger(ExportarDatosService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async exportar(opciones: OpcionesExport, destino: Writable): Promise<void> {
    const zip = archiver('zip', { zlib: { level: 6 } });
    const errores: string[][] = [];
    zip.on('warning', (e) =>
      this.logger.warn({ err: e }, 'Aviso al armar ZIP'),
    );
    zip.pipe(destino);
    // Si el navegador corta la descarga, se deja de leer BD y bucket.
    const corte = new AbortController();
    let terminado = false;
    destino.once('close', () => {
      if (!terminado) corte.abort();
    });
    const agregar = (fuente: Readable | Buffer, nombre: string) =>
      this.agregar(zip, fuente, nombre, corte.signal);

    const inicio = Date.now();
    this.logger.log(
      {
        organizacionId: opciones.organizacionId,
        usuarioId: opciones.usuarioId,
        secciones: opciones.secciones,
        incluirMedios: opciones.incluirMedios,
      },
      'Exportación de datos iniciada',
    );

    try {
      const org = await this.prisma.organizacion.findUnique({
        where: { id: opciones.organizacionId },
        select: { zonaHoraria: true },
      });
      const zona = org?.zonaHoraria ?? 'America/Lima';

      for (const seccion of opciones.secciones) {
        for (const tabla of TABLAS_POR_SECCION[seccion]) {
          await agregar(
            Readable.from(this.csvTabla(opciones.organizacionId, tabla, zona)),
            tabla.archivo,
          );
        }
      }

      if (opciones.incluirMedios && opciones.secciones.includes('chats')) {
        await this.agregarMedios(
          agregar,
          opciones.organizacionId,
          zona,
          errores,
        );
      }

      if (errores.length > 0) {
        const csv =
          CSV_BOM +
          filaCsv(['ID mensaje', 'Motivo']) +
          errores.map((e) => filaCsv(e)).join('');
        await agregar(Buffer.from(csv, 'utf8'), 'errores.csv');
      }
      await agregar(
        Buffer.from(this.leeme(opciones, zona), 'utf8'),
        'LEEME.txt',
      );

      await zip.finalize();
      terminado = true;
      this.logger.log(
        {
          organizacionId: opciones.organizacionId,
          usuarioId: opciones.usuarioId,
          bytes: zip.pointer(),
          errores: errores.length,
          ms: Date.now() - inicio,
        },
        'Exportación de datos terminada',
      );
    } catch (e: unknown) {
      terminado = true;
      if (corte.signal.aborted) {
        this.logger.warn(
          {
            organizacionId: opciones.organizacionId,
            usuarioId: opciones.usuarioId,
          },
          'Exportación de datos cancelada por el cliente',
        );
      } else {
        this.logger.error(
          { err: e, organizacionId: opciones.organizacionId },
          'Exportación de datos falló',
        );
      }
      zip.abort();
      destino.destroy(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /** Agrega una entrada y espera a que el ZIP la termine de escribir. */
  private async agregar(
    zip: Archiver,
    fuente: Readable | Buffer,
    nombre: string,
    signal: AbortSignal,
  ): Promise<void> {
    const escrita = once(zip, 'entry', { signal });
    zip.append(fuente, { name: nombre });
    await escrita;
  }

  private async *csvTabla(
    organizacionId: string,
    tabla: TablaExport,
    zona: string,
  ): AsyncGenerator<string> {
    const delegado = this.prisma[tabla.modelo] as unknown as DelegadoPaginable;
    const select =
      tabla.select ??
      Object.fromEntries(
        tabla.columnas.map(([campo]) => [campo, true] as const),
      );
    yield CSV_BOM + filaCsv(tabla.columnas.map(([, titulo]) => titulo));
    const fechas = (valores: unknown[]) =>
      valores.map((v, i) =>
        v instanceof Date
          ? formatearFecha(v, zona, tabla.columnas[i]?.[2] === 'dia')
          : v,
      );

    let cursor: string | undefined;
    for (;;) {
      const filas = await delegado.findMany({
        where: { organizacionId },
        select: { ...select, id: true },
        orderBy: { id: 'asc' },
        take: LOTE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (filas.length === 0) return;
      let bloque = '';
      for (const fila of filas) {
        bloque += filaCsv(
          fechas(
            tabla.mapear
              ? tabla.mapear(fila)
              : tabla.columnas.map(([campo]) => fila[campo]),
          ),
        );
      }
      yield bloque;
      cursor = filas[filas.length - 1].id as string;
      if (filas.length < LOTE) return;
    }
  }

  private async agregarMedios(
    agregar: (fuente: Readable | Buffer, nombre: string) => Promise<void>,
    organizacionId: string,
    zona: string,
    errores: string[][],
  ): Promise<void> {
    const indice: string[] = [
      CSV_BOM +
        filaCsv([
          'ID mensaje',
          'ID conversación',
          'Fecha',
          'Tipo de mensaje',
          'Nombre original',
          'Tipo de archivo',
          'Tamaño (bytes)',
          'Archivo en el ZIP',
        ]),
    ];
    // Un mismo archivo (sha256) puede estar en varios mensajes: va una vez.
    const yaEscritos = new Set<string>();
    let cursor: string | undefined;

    for (;;) {
      const lote = await this.prisma.whatsappMensajeMedia.findMany({
        where: { whatsappMensaje: { organizacionId } },
        select: {
          whatsappMensajeId: true,
          mediaObjeto: {
            select: {
              sha256: true,
              objectKey: true,
              mimeType: true,
              tamanoBytes: true,
            },
          },
          whatsappMensaje: {
            select: {
              whatsappConversacionId: true,
              fechaMensaje: true,
              tipo: true,
              mediaNombreArchivo: true,
              mediaMimeType: true,
            },
          },
        },
        orderBy: { whatsappMensajeId: 'asc' },
        take: LOTE_MEDIOS,
        ...(cursor ? { cursor: { whatsappMensajeId: cursor }, skip: 1 } : {}),
      });
      if (lote.length === 0) break;

      for (const fila of lote) {
        const m = fila.whatsappMensaje;
        const mime = fila.mediaObjeto?.mimeType ?? m.mediaMimeType;
        let sha = fila.mediaObjeto?.sha256 ?? null;
        let tamano = fila.mediaObjeto?.tamanoBytes ?? null;
        let fuente: Readable | Buffer | null = null;

        try {
          if (fila.mediaObjeto) {
            const nombre = `medios/${sha}${extension(mime, m.mediaNombreArchivo)}`;
            if (!yaEscritos.has(nombre)) {
              fuente = await this.storage.getStream(fila.mediaObjeto.objectKey);
            }
          } else {
            // Legado: bytes todavía en Postgres (antes de migrar a MinIO).
            const legado = await this.prisma.whatsappMensajeMedia.findUnique({
              where: { whatsappMensajeId: fila.whatsappMensajeId },
              select: { bytes: true },
            });
            if (!legado?.bytes)
              throw new Error('Sin archivo en bucket ni en BD');
            const buffer = Buffer.from(legado.bytes);
            sha = createHash('sha256').update(buffer).digest('hex');
            tamano = buffer.length;
            fuente = buffer;
          }
        } catch (e: unknown) {
          errores.push([
            fila.whatsappMensajeId,
            e instanceof Error ? e.message : String(e),
          ]);
          continue;
        }

        const nombre = `medios/${sha}${extension(mime, m.mediaNombreArchivo)}`;
        if (fuente && !yaEscritos.has(nombre)) {
          await agregar(fuente, `chats/${nombre}`);
          yaEscritos.add(nombre);
        }
        indice.push(
          filaCsv([
            fila.whatsappMensajeId,
            m.whatsappConversacionId,
            formatearFecha(m.fechaMensaje, zona),
            m.tipo,
            m.mediaNombreArchivo,
            mime,
            tamano,
            `chats/${nombre}`,
          ]),
        );
      }

      cursor = lote[lote.length - 1].whatsappMensajeId;
      if (lote.length < LOTE_MEDIOS) break;
    }

    await agregar(Buffer.from(indice.join(''), 'utf8'), 'chats/medios.csv');
  }

  /**
   * Tamaño aproximado del ZIP para la barra de avance del cliente (el ZIP va
   * en streaming y no tiene Content-Length). Los archivos de WhatsApp ya están
   * comprimidos, así que pesan casi lo mismo dentro del ZIP; los CSV se estiman
   * por cantidad de filas con un promedio por fila.
   */
  async estimarBytes(opciones: OpcionesExport): Promise<number> {
    const where = { organizacionId: opciones.organizacionId };
    const conChats = opciones.secciones.includes('chats');
    const [leads, mensajes, conversaciones, medios] = await Promise.all([
      opciones.secciones.includes('leads')
        ? this.prisma.lead.count({ where })
        : 0,
      conChats ? this.prisma.whatsappMensaje.count({ where }) : 0,
      conChats ? this.prisma.whatsappConversacion.count({ where }) : 0,
      opciones.incluirMedios && conChats
        ? this.prisma.whatsappMediaObjeto.aggregate({
            where,
            _sum: { tamanoBytes: true },
          })
        : null,
    ]);
    const csv = leads * 300 + mensajes * 70 + conversaciones * 80 + 20_000;
    return Math.round(csv + (medios?._sum.tamanoBytes ?? 0));
  }

  private leeme(opciones: OpcionesExport, zona: string): string {
    return [
      'Exportación de datos del CRM',
      `Generada: ${formatearFecha(new Date(), zona)} (${zona})`,
      `Secciones: ${opciones.secciones.join(', ')}`,
      `Archivos de WhatsApp: ${opciones.incluirMedios ? 'sí' : 'no'}`,
      '',
      'Cada carpeta tiene un CSV por tabla (UTF-8, separado por comas).',
      `Fechas en hora local de la empresa (${zona}), formato AAAA-MM-DD HH:mm:ss.`,
      'Las columnas "ID ..." enlazan archivos entre sí (ej. "ID lead" en leads.csv y visitas.csv).',
      'chats/medios.csv indica qué archivo de chats/medios/ corresponde a cada mensaje.',
      'Si algún archivo no se pudo leer, aparece en errores.csv.',
      '',
    ].join('\r\n');
  }
}
