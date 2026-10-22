import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { Organizacion } from '@prisma/client';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../shared/application/ports/object-storage.port';
import { claveLogoOrganizacion } from '../../shared/domain/logo-organizacion';
import {
  ORGANIZACIONES_REPOSITORY,
  type OrganizacionesRepository,
} from './ports/organizaciones.repository.port';
import { toOrganizacionResponse } from './organizacion-response.mapper';

export const LIMITE_LOGO_BYTES = 2 * 1024 * 1024;
const MIMES_LOGO = new Set(['image/png', 'image/jpeg', 'image/webp']);

@Injectable()
export class LogoOrganizacionService {
  private readonly logger = new Logger(LogoOrganizacionService.name);
  constructor(
    @Inject(ORGANIZACIONES_REPOSITORY)
    private readonly organizaciones: OrganizacionesRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  private async actual(organizacionId: string) {
    const org = await this.organizaciones.findActivaById(organizacionId);
    if (!org) throw new NotFoundException('Organización no encontrada');
    return org;
  }

  private async borrarAnterior(clave: string | null) {
    if (!clave) return;
    try {
      await this.storage.delete(clave);
    } catch {
      this.logger.warn('No se pudo eliminar una versión anterior del logo');
    }
  }

  async subir(
    organizacionId: string,
    usuarioId: string,
    archivo?: { buffer: Buffer; mimetype: string },
  ) {
    const org = await this.actual(organizacionId);
    if (!archivo?.buffer.length)
      throw new BadRequestException('Selecciona una imagen para el logo');
    if (archivo.buffer.length > LIMITE_LOGO_BYTES)
      throw new PayloadTooLargeException('El logo debe pesar como máximo 2 MB');
    if (!MIMES_LOGO.has(archivo.mimetype))
      throw new BadRequestException('Usa una imagen PNG, JPG o WebP');
    let imagen: Buffer;
    try {
      const procesador = sharp(archivo.buffer, {
        limitInputPixels: 16_777_216,
        failOn: 'error',
      });
      const meta = await procesador.metadata();
      if (
        !meta.format ||
        !['png', 'jpeg', 'webp'].includes(meta.format) ||
        !meta.width ||
        !meta.height ||
        (meta.pages ?? 1) > 1
      )
        throw new Error('Formato no permitido');
      imagen = await procesador
        .rotate()
        .resize({
          width: 1024,
          height: 1024,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 90 })
        .toBuffer();
    } catch {
      throw new BadRequestException(
        'La imagen no es válida. Usa un PNG, JPG o WebP estático de hasta 16 megapíxeles',
      );
    }

    const clave = `organizations/${organizacionId}/branding/${randomUUID()}.webp`;
    await this.storage.put({
      key: clave,
      body: imagen,
      contentType: 'image/webp',
    });
    let actualizada: Organizacion;
    try {
      actualizada = await this.organizaciones.actualizar(
        organizacionId,
        { logoUrl: clave },
        usuarioId,
      );
    } catch (error) {
      await this.borrarAnterior(clave);
      throw error;
    }
    // No elimina objetos de otra empresa ni URLs externas heredadas.
    await this.borrarAnterior(
      claveLogoOrganizacion(organizacionId, org.logoUrl),
    );
    return toOrganizacionResponse(actualizada);
  }

  async quitar(organizacionId: string, usuarioId: string) {
    const org = await this.actual(organizacionId);
    const actualizada = await this.organizaciones.actualizar(
      organizacionId,
      { logoUrl: null },
      usuarioId,
    );
    await this.borrarAnterior(
      claveLogoOrganizacion(organizacionId, org.logoUrl),
    );
    return toOrganizacionResponse(actualizada);
  }

  async obtener(organizacionId: string, version?: string) {
    const org = await this.actual(organizacionId);
    const clave = claveLogoOrganizacion(organizacionId, org.logoUrl);
    if (!clave || (version && clave.split('/').at(-1) !== version))
      throw new NotFoundException('Logo no disponible');
    try {
      return await this.storage.getBuffer(clave);
    } catch {
      throw new NotFoundException('Logo no disponible');
    }
  }
}
