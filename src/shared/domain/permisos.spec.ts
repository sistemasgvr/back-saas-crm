import {
  filtrarPorModulos,
  normalizarPermisos,
  PERMISOS_CATALOGO,
  permisosPorDefecto,
  ROLES_SISTEMA,
  tienePermiso,
  TODOS_LOS_PERMISOS,
} from './permisos';
import { permisosDelRol } from '../infrastructure/permisos-efectivos';

describe('catálogo de permisos', () => {
  it('no repite códigos y sus requeridos existen', () => {
    const codigos = PERMISOS_CATALOGO.map((p) => p.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    for (const p of PERMISOS_CATALOGO)
      for (const r of p.requiere) expect(codigos).toContain(r);
  });

  // Equivalencia con los chequeos por rol anteriores (PLAN §7.1): si esto
  // cambia, la migración deja de ser neutra para los clientes actuales.
  it('ADMINISTRADOR conserva todos los permisos y USUARIO solo los de asesor', () => {
    expect(permisosPorDefecto('ADMINISTRADOR')).toEqual([
      ...TODOS_LOS_PERMISOS,
    ]);
    expect(permisosPorDefecto('USUARIO').sort()).toEqual(
      [
        'chats.responder',
        'chats.ver',
        'inmuebles.ver',
        'leads.editar',
        'leads.reclamar',
        'leads.ver',
        'llamadas.usar',
        'meta.ver',
      ].sort(),
    );
    expect(permisosPorDefecto('PERSONALIZADO')).toEqual([]);
  });

  it('los roles de sistema ya están normalizados', () => {
    for (const r of ROLES_SISTEMA)
      expect(normalizarPermisos(r.permisos)).toEqual([...r.permisos]);
  });
});

describe('normalizarPermisos', () => {
  it('agrega requeridos de forma transitiva y descarta desconocidos', () => {
    expect(normalizarPermisos(['leads.asignar', 'no.existe'])).toEqual([
      'leads.ver',
      'leads.ver_todos',
      'leads.asignar',
    ]);
  });
});

describe('filtrarPorModulos', () => {
  it('quita permisos de módulos apagados y conserva los de empresa', () => {
    expect(
      filtrarPorModulos(
        ['empresa.configurar', 'leads.ver', 'inmuebles.ver'],
        ['LEADS'],
      ),
    ).toEqual(['empresa.configurar', 'leads.ver']);
  });
});

describe('tienePermiso', () => {
  it('usa los permisos efectivos cuando vienen en el contexto', () => {
    expect(
      tienePermiso(
        { rol: 'ADMINISTRADOR', permisos: ['leads.ver'] },
        'leads.ver_todos',
      ),
    ).toBe(false);
    expect(
      tienePermiso(
        { rol: 'USUARIO', permisos: ['leads.ver_todos'] },
        'leads.ver_todos',
      ),
    ).toBe(true);
  });

  it('sin permisos en el contexto usa el rol de sistema y falla cerrada', () => {
    expect(tienePermiso({ rol: 'ADMINISTRADOR' }, 'leads.ver_todos')).toBe(
      true,
    );
    expect(tienePermiso({ rol: 'USUARIO' }, 'leads.ver_todos')).toBe(false);
    expect(tienePermiso({ rol: 'PERSONALIZADO' }, 'leads.ver')).toBe(false);
  });
});

describe('permisosDelRol (PLAN §4.2)', () => {
  const sistema = { id: 's', nombre: 'Asesor', permisos: ['leads.ver'] };
  const propio = {
    id: 'p',
    nombre: 'Supervisor',
    permisos: ['leads.ver_todos'],
  };

  it('PROPIETARIO tiene todo', () => {
    expect(permisosDelRol('PROPIETARIO', null, null, true).permisos).toEqual([
      ...TODOS_LOS_PERMISOS,
    ]);
  });

  it('el rol asignado tiene prioridad sobre el de sistema', () => {
    expect(permisosDelRol('PERSONALIZADO', propio, null, true)).toEqual({
      rolId: 'p',
      rolNombre: 'Supervisor',
      permisos: ['leads.ver_todos'],
    });
  });

  it('sin rol asignado usa el de sistema guardado', () => {
    expect(permisosDelRol('USUARIO', null, sistema, true).permisos).toEqual([
      'leads.ver',
    ]);
  });

  it('empresa sin roles guardados usa los permisos por defecto', () => {
    expect(permisosDelRol('USUARIO', null, null, false).permisos).toEqual(
      permisosPorDefecto('USUARIO'),
    );
  });

  it('rol personalizado inexistente o desactivado no tiene permisos', () => {
    expect(permisosDelRol('PERSONALIZADO', null, null, true).permisos).toEqual(
      [],
    );
  });
});
