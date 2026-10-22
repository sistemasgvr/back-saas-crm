import {
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Organizacion } from '@prisma/client';
import sharp from 'sharp';
import type { ObjectStorage } from '../../shared/application/ports/object-storage.port';
import type { OrganizacionesRepository } from './ports/organizaciones.repository.port';
import {
  LIMITE_LOGO_BYTES,
  LogoOrganizacionService,
} from './logo-organizacion.service';
import {
  claveLogoOrganizacion,
  logoOrganizacionUrl,
} from '../../shared/domain/logo-organizacion';
import { OrganizationLogoController } from '../presentation/organization-logo.controller';
import { ROLES_KEY } from '../../shared/presentation/decorators/roles.decorator';

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const OLD = `organizations/${ORG}/branding/33333333-3333-4333-8333-333333333333.webp`;
const png = () =>
  sharp({
    create: {
      width: 1200,
      height: 400,
      channels: 4,
      background: { r: 10, g: 90, b: 180, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();

function fixture(logoUrl: string | null = null) {
  const org = { id: ORG, nombre: 'Empresa', logoUrl } as Organizacion;
  const repo = {
    findActivaById: jest.fn().mockResolvedValue(org),
    actualizar: jest
      .fn()
      .mockImplementation((_id: string, data: { logoUrl?: string | null }) =>
        Promise.resolve({ ...org, ...data }),
      ),
  };
  const storage = {
    put: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    getBuffer: jest.fn().mockResolvedValue(Buffer.from('webp')),
  };
  return {
    repo,
    storage,
    service: new LogoOrganizacionService(
      repo as unknown as OrganizacionesRepository,
      storage as unknown as ObjectStorage,
    ),
  };
}

describe('Logo independiente por empresa en el bucket compartido', () => {
  it('reutiliza storage.put con prefijo de empresa y optimiza tamaño y transparencia', async () => {
    const { service, repo, storage } = fixture();
    const result = await service.subir(ORG, 'admin', {
      buffer: await png(),
      mimetype: 'image/png',
    });
    const input = storage.put.mock.calls[0] as [
      { key: string; body: Buffer; contentType: string },
    ];
    expect(input[0].key).toMatch(
      new RegExp(`^organizations/${ORG}/branding/[a-f0-9-]+\\.webp$`),
    );
    expect(input[0].contentType).toBe('image/webp');
    const image = await sharp(input[0].body).metadata();
    expect(image.width).toBe(1024);
    expect(image.height).toBe(341);
    expect(image.hasAlpha).toBe(true);
    expect(repo.actualizar).toHaveBeenCalledWith(
      ORG,
      { logoUrl: input[0].key },
      'admin',
    );
    expect(result.logoUrl).toMatch(/^\/api\/organizations\/logo\?v=/);
    expect(result.logoUrl).not.toContain(ORG);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('al reemplazar elimina solo la versión anterior de la misma empresa', async () => {
    const { service, storage } = fixture(OLD);
    await service.subir(ORG, 'admin', {
      buffer: await png(),
      mimetype: 'image/png',
    });
    expect(storage.delete).toHaveBeenCalledWith(OLD);
  });

  it.each([
    null,
    `organizations/${OTHER}/branding/33333333-3333-4333-8333-333333333333.webp`,
    'https://example.com/logo.png',
  ])(
    'no elimina referencias ajenas ni URLs heredadas: %s',
    async (referencia) => {
      const { service, storage } = fixture(referencia);
      await service.quitar(ORG, 'admin');
      expect(storage.delete).not.toHaveBeenCalled();
    },
  );

  it('quitar limpia la referencia y restaura el logo por defecto', async () => {
    const { service, storage, repo } = fixture(OLD);
    expect((await service.quitar(ORG, 'admin')).logoUrl).toBeNull();
    expect(repo.actualizar).toHaveBeenCalledWith(
      ORG,
      { logoUrl: null },
      'admin',
    );
    expect(storage.delete).toHaveBeenCalledWith(OLD);
  });

  it('si falla la BD limpia el archivo nuevo y conserva el anterior', async () => {
    const { service, storage, repo } = fixture(OLD);
    repo.actualizar.mockRejectedValueOnce(new Error('BD no disponible'));
    await expect(
      service.subir(ORG, 'admin', {
        buffer: await png(),
        mimetype: 'image/png',
      }),
    ).rejects.toThrow('BD no disponible');
    const input = storage.put.mock.calls[0] as [{ key: string }];
    expect(storage.delete).toHaveBeenCalledWith(input[0].key);
    expect(storage.delete).not.toHaveBeenCalledWith(OLD);
  });

  it('si MinIO falla no cambia el logo guardado', async () => {
    const { service, storage, repo } = fixture(OLD);
    storage.put.mockRejectedValueOnce(new Error('Storage no disponible'));
    await expect(
      service.subir(ORG, 'admin', {
        buffer: await png(),
        mimetype: 'image/png',
      }),
    ).rejects.toThrow('Storage no disponible');
    expect(repo.actualizar).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('rechaza archivos vacíos, demasiado grandes, corruptos y SVG disfrazado', async () => {
    const { service, storage } = fixture();
    await expect(service.subir(ORG, 'admin')).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.subir(ORG, 'admin', {
        buffer: Buffer.alloc(LIMITE_LOGO_BYTES + 1),
        mimetype: 'image/png',
      }),
    ).rejects.toThrow(PayloadTooLargeException);
    await expect(
      service.subir(ORG, 'admin', {
        buffer: Buffer.from('no es imagen'),
        mimetype: 'image/png',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.subir(ORG, 'admin', {
        buffer: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
        ),
        mimetype: 'image/png',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.subir(ORG, 'admin', {
        buffer: await png(),
        mimetype: 'image/svg+xml',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('solo lee el objeto de la empresa activa y rechaza versiones antiguas', async () => {
    const { service, storage } = fixture(OLD);
    await expect(service.obtener(ORG, OLD.split('/').at(-1))).resolves.toEqual(
      Buffer.from('webp'),
    );
    expect(storage.getBuffer).toHaveBeenCalledWith(OLD);
    await expect(service.obtener(ORG, 'otra-version.webp')).rejects.toThrow(
      NotFoundException,
    );
    const ajena = fixture(OLD.replace(ORG, OTHER));
    await expect(ajena.service.obtener(ORG)).rejects.toThrow(NotFoundException);
    expect(ajena.storage.getBuffer).not.toHaveBeenCalled();
  });

  it('no permite atravesar carpetas ni convertir una clave ajena en una URL', () => {
    expect(claveLogoOrganizacion(ORG, OLD)).toBe(OLD);
    expect(claveLogoOrganizacion(OTHER, OLD)).toBeNull();
    expect(
      claveLogoOrganizacion(ORG, `organizations/${ORG}/branding/../otro.webp`),
    ).toBeNull();
    expect(logoOrganizacionUrl(OTHER, OLD)).toBeNull();
    expect(logoOrganizacionUrl(ORG, null)).toBeNull();
    expect(logoOrganizacionUrl(ORG, 'https://example.com/logo.png')).toBe(
      'https://example.com/logo.png',
    );
  });

  it('solo administradores pueden modificar; cualquier miembro autenticado puede ver', () => {
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        Object.getOwnPropertyDescriptor(
          OrganizationLogoController.prototype,
          'subir',
        )!.value as object,
      ),
    ).toEqual(['PROPIETARIO', 'ADMINISTRADOR']);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        Object.getOwnPropertyDescriptor(
          OrganizationLogoController.prototype,
          'quitar',
        )!.value as object,
      ),
    ).toEqual(['PROPIETARIO', 'ADMINISTRADOR']);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        Object.getOwnPropertyDescriptor(
          OrganizationLogoController.prototype,
          'obtener',
        )!.value as object,
      ),
    ).toBeUndefined();
  });
});
