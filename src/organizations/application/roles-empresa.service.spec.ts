import { ConflictException, ForbiddenException } from '@nestjs/common';
import { RolesEmpresaService } from './roles-empresa.service';
import { resolverPermisosEfectivos } from '../../shared/infrastructure/permisos-efectivos';
import { permisosPorDefecto } from '../../shared/domain/permisos';

jest.mock('../../shared/infrastructure/permisos-efectivos', () => ({
  resolverPermisosEfectivos: jest.fn(),
}));

const resolver = resolverPermisosEfectivos as jest.Mock;
const ctx = {
  usuarioId: 'actor',
  organizacionId: 'org',
  esAdminPlataforma: false,
};

function fixture(roles: Record<string, unknown>[] = []) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    organizacionModulo: {
      findMany: jest.fn().mockResolvedValue(
        ['LEADS', 'INMUEBLES', 'WHATSAPP', 'DASHBOARD'].map((codigo) => ({
          modulo: { codigo, nombre: codigo, orden: 0 },
        })),
      ),
    },
    organizacionRol: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn().mockResolvedValue(3),
      findFirst: jest.fn(
        ({ where }: { where: { id?: string; nombre?: unknown } }) =>
          where.nombre ? null : (roles.find((r) => r.id === where.id) ?? null),
      ),
      findMany: jest.fn().mockResolvedValue(roles),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
        id: 'nuevo',
        organizacionId: 'org',
        ...data,
      })),
      update: jest.fn(
        ({ where, data }: { where: { id: string }; data: object }) => ({
          ...roles.find((r) => r.id === where.id),
          ...data,
        }),
      ),
    },
    organizacionUsuario: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    organizacionRolEvento: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  return { tx, service: new RolesEmpresaService(prisma as never) };
}

const admin = {
  rol: 'ADMINISTRADOR',
  rolId: 'rol-admin',
  rolNombre: 'Administrador',
  permisos: permisosPorDefecto('ADMINISTRADOR').filter(
    (p) => p !== 'dashboard.ver',
  ),
};
const asesor = {
  id: 'rol-asesor',
  organizacionId: 'org',
  codigo: 'USUARIO',
  nombre: 'Asesor',
  esSistema: 1,
  estado: 1,
  permisos: permisosPorDefecto('USUARIO'),
};

describe('RolesEmpresaService', () => {
  beforeEach(() => resolver.mockReset());

  it('crea un rol con los permisos requeridos agregados', async () => {
    resolver.mockResolvedValue(admin);
    const { tx, service } = fixture();
    await service.crear(
      'org',
      { nombre: 'Supervisor', permisos: ['leads.asignar'] },
      ctx,
    );
    expect(tx.organizacionRol.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          permisos: ['leads.ver', 'leads.ver_todos', 'leads.asignar'],
        }) as unknown,
      }),
    );
  });

  it('no deja otorgar permisos que el actor no tiene', async () => {
    resolver.mockResolvedValue(admin);
    const { service } = fixture();
    await expect(
      service.crear(
        'org',
        { nombre: 'Gerente', permisos: ['dashboard.ver'] },
        ctx,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('no deja editar el propio rol', async () => {
    resolver.mockResolvedValue({ ...admin, rolId: 'rol-asesor' });
    const { service } = fixture([asesor]);
    await expect(
      service.actualizar('org', 'rol-asesor', { permisos: ['leads.ver'] }, ctx),
    ).rejects.toThrow('No puedes editar tu propio rol.');
  });

  it('el rol Propietario no se edita', async () => {
    resolver.mockResolvedValue({ ...admin, rol: 'PROPIETARIO' });
    const { service } = fixture([
      {
        ...asesor,
        id: 'rol-prop',
        codigo: 'PROPIETARIO',
        nombre: 'Propietario',
      },
    ]);
    await expect(
      service.actualizar('org', 'rol-prop', { permisos: [] }, ctx),
    ).rejects.toThrow(ForbiddenException);
  });

  it('conserva permisos guardados de módulos apagados', async () => {
    resolver.mockResolvedValue({ ...admin, rol: 'PROPIETARIO' });
    const { tx, service } = fixture([
      { ...asesor, permisos: [...asesor.permisos, 'meta.ver'] },
    ]);
    await service.actualizar(
      'org',
      'rol-asesor',
      { permisos: ['leads.ver'] },
      ctx,
    );
    expect(tx.organizacionRol.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          permisos: ['leads.ver', 'meta.ver'],
        }) as unknown,
      }),
    );
  });

  it('no desactiva un rol con usuarios activos ni roles de sistema', async () => {
    resolver.mockResolvedValue({ ...admin, rol: 'PROPIETARIO' });
    const personal = {
      ...asesor,
      id: 'rol-x',
      codigo: null,
      esSistema: 0,
      nombre: 'X',
    };
    const { tx, service } = fixture([asesor, personal]);
    await expect(service.desactivar('org', 'rol-asesor', ctx)).rejects.toThrow(
      ConflictException,
    );
    tx.organizacionUsuario.count.mockResolvedValue(2);
    await expect(service.desactivar('org', 'rol-x', ctx)).rejects.toThrow(
      'El rol tiene 2 usuario(s) activo(s). Asígnales otro rol primero.',
    );
  });

  it('sin roles.gestionar ni usuarios.gestionar no lista', async () => {
    resolver.mockResolvedValue({ ...admin, permisos: ['leads.ver'] });
    const { service } = fixture();
    await expect(service.listar('org', ctx)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
