import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ControlAtencionService,
  type ActorSalida,
} from './control-atencion.service';
import { EnviarMensajeWhatsAppUseCase } from './use-cases/enviar-mensaje-whatsapp.use-case';
import type { BotEmpresaService } from './bot-empresa.service';
import { AxiosError, type AxiosResponse } from 'axios';
import { excepcionDesdeErrorMeta } from '../../../meta/connections/application/mapear-error-meta-graph';

/** Simula dos instancias con almacenamiento compartido y transacciones
 * serializadas. Las pruebas contra PostgreSQL real están en test/. */
// El doble de Prisma interpreta objetos where/update dinámicamente;
// este bloque simula el almacenamiento, no es código productivo.
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await */
function fixture() {
  const c = {
    id: 'chat',
    organizacionId: 'org',
    whatsappConexionId: 'linea',
    estado: 1,
    leadId: null as string | null,
    lead: null as { asignadoUsuarioId: string | null } | null,
    modoAtencion: 'BOT_ACTIVO',
    controlVersion: 0,
    entradaRevision: 0,
    controlUsuarioId: null,
    bloqueado: 0,
    ventanaExpiraEn: new Date(Date.now() + 60_000),
  };
  const intentos: {
    id: string;
    actor: string;
    estado: string;
    [key: string]: unknown;
  }[] = [];
  const miembros: {
    usuarioId: string;
    rol: string;
    usuario: { id: string; nombre: string; apellido: string | null };
  }[] = [];
  const eventos: { motivo: string; [key: string]: unknown }[] = [];
  const mensajes: Record<string, unknown>[] = [];
  let habilitado = true;
  let configVersion = 0;
  let moduloActivo = true;
  let miembroActivo = true;
  let lineaActiva = true;
  let cola = Promise.resolve();
  const matches = (row: any, where: any): boolean =>
    Object.entries(where).every(([k, v]: any) =>
      k === 'OR'
        ? v.some((w: any) => matches(row, w))
        : v?.in
          ? v.in.includes(row[k])
          : row[k] === v,
    );
  const tx = {
    $queryRaw: jest.fn(async () => []),
    whatsappConversacion: {
      updateMany: jest.fn(async ({ where, data }) => {
        if (!matches(c, where)) return { count: 0 };
        for (const [k, v] of Object.entries(data) as any)
          c[k] = v?.increment ? c[k] + v.increment : v;
        return { count: 1 };
      }),
      findFirst: jest.fn(async ({ where }) =>
        where.id === c.id && where.organizacionId === c.organizacionId
          ? { ...c }
          : null,
      ),
      update: jest.fn(async ({ data }) => {
        for (const [k, v] of Object.entries(data) as any)
          c[k] = v?.increment ? c[k] + v.increment : v;
        return { ...c };
      }),
    },
    lead: {
      updateMany: jest.fn(async ({ where, data }) => {
        if (
          !c.lead ||
          c.leadId !== where.id ||
          c.lead?.asignadoUsuarioId !== where.asignadoUsuarioId
        )
          return { count: 0 };
        c.lead.asignadoUsuarioId = data.asignadoUsuarioId;
        return { count: 1 };
      }),
    },
    organizacionUsuario: {
      findMany: jest.fn(async () => miembros),
      findFirst: jest.fn(async ({ where }) =>
        miembroActivo
          ? {
              usuarioId: where.usuarioId,
              rol: where.usuarioId === 'admin' ? 'ADMINISTRADOR' : 'USUARIO',
            }
          : null,
      ),
    },
    whatsappControlEvento: {
      findUnique: jest.fn(
        async ({ where }) =>
          eventos.find((e) => matches(e, where.organizacionId_wamid)) ?? null,
      ),
      create: jest.fn(async ({ data }) => {
        eventos.push({ ...data });
        return data;
      }),
      findMany: jest.fn(async () => eventos),
    },
    whatsappSalidaIntento: {
      count: jest.fn(
        async ({ where }) => intentos.filter((r) => matches(r, where)).length,
      ),
      findFirst: jest.fn(
        async ({ where }) => intentos.find((r) => matches(r, where)) ?? null,
      ),
      findUnique: jest.fn(
        async ({ where }) =>
          intentos.find((r) => matches(r, where.organizacionId_clave)) ?? null,
      ),
      findMany: jest.fn(async ({ where }) =>
        intentos.filter((r) => matches(r, where)),
      ),
      create: jest.fn(async ({ data }) => {
        const i = {
          ...data,
          id: `intento-${intentos.length}`,
          mensajePersistido: false,
        };
        intentos.push(i);
        return i;
      }),
      update: jest.fn(async ({ where, data }) => {
        const i = intentos.find((i) => i.id === where.id);
        Object.assign(i!, data);
        return i;
      }),
    },
    whatsappMensaje: {
      findUnique: jest.fn(
        async ({ where }) =>
          mensajes.find((m) => matches(m, where.organizacionId_wamid)) ?? null,
      ),
      updateMany: jest.fn(async ({ where, data }) => {
        const ms = mensajes.filter((m) => matches(m, where));
        ms.forEach((m) => Object.assign(m, data));
        return { count: ms.length };
      }),
    },
    organizacion: { findUnique: jest.fn(async () => ({ estado: 1 })) },
    organizacionModulo: {
      findFirst: jest.fn(async () => (moduloActivo ? { id: 'modulo' } : null)),
    },
    whatsappBotConfiguracionEvento: {
      create: jest.fn(async ({ data }) => data),
      findMany: jest.fn(async () => []),
    },
    whatsappBotConfiguracion: {
      findUnique: jest.fn(async () => ({ habilitado, version: configVersion })),
    },
    whatsappConexion: {
      findFirst: jest.fn(async () => (lineaActiva ? { id: 'linea' } : null)),
    },
    usuario: {
      findMany: jest.fn(async () => miembros.map((m) => m.usuario)),
      findFirst: jest.fn(async ({ where }) =>
        where.id === 'platform' ? { id: 'platform' } : null,
      ),
      findUnique: jest.fn(async ({ where }) => ({
        id: where.id,
        nombre: 'Asesor',
        apellido: null,
      })),
    },
  };
  const prisma: any = {
    ...tx,
    $transaction: (fn: any) => {
      const run = cola.then(() => fn(tx));
      cola = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
  const ws = { emitirAOrganizacion: jest.fn(), emitirAUsuarios: jest.fn() };
  const bot = {
    requiereBot: jest.fn().mockResolvedValue(undefined),
    integracion: jest.fn().mockReturnValue({ operativa: true }),
    disponibilidad: jest
      .fn()
      .mockResolvedValue({ autorizado: true, config: { modoInicial: 'BOT' } }),
  };
  return {
    service: new ControlAtencionService(
      prisma,
      ws,
      bot as unknown as BotEmpresaService,
    ),
    replica: new ControlAtencionService(
      prisma,
      ws,
      bot as unknown as BotEmpresaService,
    ),
    bot,
    c: () => c,
    intentos,
    miembros,
    eventos,
    mensajes,
    tx,
    ws,
    cambiarConfiguracion: (activo: boolean, version: number) => {
      habilitado = activo;
      configVersion = version;
    },
    desactivarModulo: () => {
      moduloActivo = false;
    },
    deshabilitar: () => {
      habilitado = false;
    },
    revocar: () => {
      miembroActivo = false;
    },
    desconectar: () => {
      lineaActiva = false;
    },
  };
}
/* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await */
const humano = { usuarioId: 'ana', rol: 'USUARIO' as const };
const bot = (clave = 'salida-1'): Extract<ActorSalida, { tipo: 'BOT' }> => ({
  tipo: 'BOT',
  configVersion: 0,
  controlVersion: 0,
  entradaRevision: 0,
  clave,
});
const metodo = 'enviarMensajeTextoWhatsApp';

describe('Control de atención WhatsApp', () => {
  it('toma explícita invalida generación antigua y no reanuda el bot', async () => {
    const f = fixture();
    const estado = await f.service.tomar('org', 'chat', humano, 0);
    expect(estado.modoAtencion).toBe('HUMANO_ACTIVO');
    expect(estado.controlUsuarioId).toBe('ana');
    const enviar = jest.fn();
    await expect(
      f.replica.despachar('org', 'chat', bot(), metodo, enviar),
    ).rejects.toThrow(ConflictException);
    expect(enviar).not.toHaveBeenCalled();
    expect(f.eventos.map((e) => e.motivo)).toEqual([
      'toma_explicita',
      'toma_confirmada',
    ]);
  });

  it('prioriza solicitud humana durante envío: pendiente hasta terminar; bloquea otras partes', async () => {
    const f = fixture();
    let resolver!: (v: { wamid: string }) => void;
    let inicio!: () => void;
    const iniciado = new Promise<void>((r) => {
      inicio = r;
    });
    const envio = f.service.despachar(
      'org',
      'chat',
      bot(),
      'enviarMediaWhatsApp',
      () => {
        inicio();
        return new Promise((r) => {
          resolver = r;
        });
      },
    );
    await iniciado;
    expect((await f.replica.tomar('org', 'chat', humano, 0)).modoAtencion).toBe(
      'TOMANDO_CONTROL',
    );
    const siguiente = jest.fn();
    await expect(
      f.replica.despachar('org', 'chat', bot('parte-2'), metodo, siguiente),
    ).rejects.toThrow(ConflictException);
    resolver({ wamid: 'wamid.1' });
    await envio;
    expect((await f.replica.estado('org', 'chat')).modoAtencion).toBe(
      'HUMANO_ACTIVO',
    );
    expect(siguiente).not.toHaveBeenCalled();
  });

  it('resuelve dos tomas concurrentes con un solo ganador', async () => {
    const f = fixture();
    const rs = await Promise.allSettled([
      f.service.tomar('org', 'chat', humano, 0),
      f.replica.tomar('org', 'chat', { usuarioId: 'bea', rol: 'USUARIO' }, 0),
    ]);
    expect(rs.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(f.c().controlUsuarioId).toBe('ana');
  });

  it('primer envío humano toma control y conserva recordatorios SYSTEM', async () => {
    const f = fixture();
    await f.service.despachar(
      'org',
      'chat',
      { tipo: 'HUMAN', ...humano },
      metodo,
      () => Promise.resolve({ wamid: 'humano' }),
    );
    const version = f.c().controlVersion;
    await f.replica.despachar(
      'org',
      'chat',
      { tipo: 'SYSTEM', origen: 'agenda_recordatorio' },
      metodo,
      () => Promise.resolve({ wamid: 'agenda' }),
    );
    expect(f.intentos.map((i) => i.actor)).toEqual(['HUMAN', 'SYSTEM']);
    expect(f.c().controlVersion).toBe(version);
    expect(f.c().modoAtencion).toBe('HUMANO_ACTIVO');
  });

  it('desconexión incierta queda persistida y nunca reintenta la misma clave', async () => {
    const f = fixture();
    await expect(
      f.service.despachar('org', 'chat', bot(), metodo, () =>
        Promise.reject(new Error('timeout después de aceptar')),
      ),
    ).rejects.toThrow('Envío incierto');
    expect(f.intentos[0].estado).toBe('INCIERTO');
    const enviar = jest.fn();
    await expect(
      f.replica.despachar('org', 'chat', bot(), metodo, enviar),
    ).rejects.toThrow('ya se intentó');
    expect(enviar).not.toHaveBeenCalled();
  });

  it('rechazo explícito de Meta queda RECHAZADO y muestra su motivo', async () => {
    const f = fixture();
    const rechazo = excepcionDesdeErrorMeta(
      new AxiosError('Request failed', '400', undefined, undefined, {
        status: 400,
        data: { error: { code: 131026, message: 'Message undeliverable' } },
      } as AxiosResponse),
    );
    await expect(
      f.service.despachar(
        'org',
        'chat',
        { tipo: 'HUMAN', ...humano },
        metodo,
        () => Promise.reject(rechazo),
      ),
    ).rejects.toThrow('Message undeliverable');
    expect(f.intentos[0].estado).toBe('RECHAZADO');
    expect(f.c().modoAtencion).toBe('HUMANO_ACTIVO');
  });

  it('salida sin fila de mensaje (reacción) no queda pendiente de registro', async () => {
    const f = fixture();
    await f.service.despachar(
      'org',
      'chat',
      { tipo: 'HUMAN', ...humano },
      'enviarReaccionWhatsApp',
      () => Promise.resolve({ wamid: 'reaccion' }),
      { registraMensaje: false },
    );
    expect(f.intentos[0]).toMatchObject({
      estado: 'ACEPTADO',
      mensajePersistido: true,
    });
  });

  it('el asignado del lead retoma el chat aunque otro asesor tenga el control', async () => {
    const f = fixture();
    await f.service.tomar('org', 'chat', humano, 0);
    f.c().leadId = 'lead';
    f.c().lead = { asignadoUsuarioId: 'bea' };
    await f.replica.despachar(
      'org',
      'chat',
      { tipo: 'HUMAN', usuarioId: 'bea', rol: 'USUARIO' },
      metodo,
      () => Promise.resolve({ wamid: 'bea' }),
    );
    expect(f.c().controlUsuarioId).toBe('bea');
    expect(f.c().modoAtencion).toBe('HUMANO_ACTIVO');
  });

  it('caída de persistencia posterior a Meta bloquea confirmación sin caducidad', async () => {
    const f = fixture();
    f.tx.whatsappSalidaIntento.update.mockRejectedValueOnce(
      new Error('DB caída'),
    );
    await expect(
      f.service.despachar('org', 'chat', bot(), metodo, () =>
        Promise.resolve({ wamid: 'aceptado' }),
      ),
    ).rejects.toThrow('DB caída');
    expect(f.intentos[0].estado).toBe('DESPACHANDO');
    expect((await f.replica.tomar('org', 'chat', humano, 0)).modoAtencion).toBe(
      'TOMANDO_CONTROL',
    );
    expect((await f.replica.estado('org', 'chat')).modoAtencion).toBe(
      'TOMANDO_CONTROL',
    );
  });

  it('valida tenant, membresía y dueño del lead desde BD', async () => {
    const f = fixture();
    await expect(f.service.tomar('otra', 'chat', humano, 0)).rejects.toThrow(
      NotFoundException,
    );
    f.c().lead = { asignadoUsuarioId: 'bea' };
    await expect(f.service.tomar('org', 'chat', humano, 0)).rejects.toThrow(
      ForbiddenException,
    );
    f.revocar();
    await expect(
      f.service.tomar(
        'org',
        'chat',
        { usuarioId: 'admin', rol: 'ADMINISTRADOR' },
        0,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(f.eventos).toHaveLength(0);
  });

  it('rechaza bot deshabilitado, nueva entrada, contacto bloqueado, ventana o línea inactiva', async () => {
    for (const invalidar of [
      (f: ReturnType<typeof fixture>) => f.deshabilitar(),
      (f: ReturnType<typeof fixture>) => {
        f.c().entradaRevision++;
      },
      (f: ReturnType<typeof fixture>) => {
        f.c().bloqueado = 1;
      },
      (f: ReturnType<typeof fixture>) => {
        f.c().ventanaExpiraEn = new Date(0);
      },
      (f: ReturnType<typeof fixture>) => f.desconectar(),
    ]) {
      const f = fixture();
      invalidar(f);
      const enviar = jest.fn();
      await expect(
        f.service.despachar('org', 'chat', bot(), metodo, enviar),
      ).rejects.toThrow();
      expect(enviar).not.toHaveBeenCalled();
    }
  });

  it('eco propio e historial no toman control; respuesta externa nueva sí', async () => {
    const f = fixture();
    await f.service.ecoExterno('org', 'chat', 'historial', true);
    await f.service.despachar('org', 'chat', bot(), metodo, () =>
      Promise.resolve({ wamid: 'propio' }),
    );
    await f.replica.ecoExterno('org', 'chat', 'propio', false);
    expect(f.c().modoAtencion).toBe('BOT_ACTIVO');
    expect(await f.service.ecoExterno('org', 'chat', 'app-nuevo', false)).toBe(
      'EXTERNAL',
    );
    expect(f.c().modoAtencion).toBe('HUMANO_ACTIVO');
  });

  it('eco ambiguo pausa sin atribuirlo falsamente a un asesor', async () => {
    const f = fixture();
    f.intentos.push({
      id: 'caido',
      organizacionId: 'org',
      conversacionId: 'chat',
      estado: 'DESPACHANDO',
      actor: 'BOT',
    });
    expect(
      await f.service.ecoExterno('org', 'chat', 'desconocido', false),
    ).toBe('UNKNOWN');
    expect(f.c().modoAtencion).toBe('TOMANDO_CONTROL');
    expect(f.c().controlUsuarioId).toBeNull();
  });

  it('ecos simultáneos del mismo wamid no duplican la toma aunque falte guardar media', async () => {
    const f = fixture();
    const resultados = await Promise.all([
      f.service.ecoExterno('org', 'chat', 'app-media', false),
      f.replica.ecoExterno('org', 'chat', 'app-media', false),
    ]);
    expect(resultados).toEqual(['EXTERNAL', 'EXTERNAL']);
    expect(f.eventos.filter((e) => e.wamid === 'app-media')).toHaveLength(1);
    expect(f.c().controlVersion).toBe(2);
  });

  it('transferencia mantiene HUMAN e impide al antiguo responsable enviar', async () => {
    const f = fixture();
    const estado = await f.service.tomar('org', 'chat', humano, 0);
    await f.service.transferir(
      'org',
      'chat',
      humano,
      'bea',
      estado.controlVersion,
    );
    const enviar = jest.fn();
    await expect(
      f.service.despachar(
        'org',
        'chat',
        { tipo: 'HUMAN', ...humano },
        metodo,
        enviar,
      ),
    ).rejects.toThrow(ConflictException);
    expect(f.c().modoAtencion).toBe('HUMANO_ACTIVO');
    expect(f.c().controlUsuarioId).toBe('bea');
    expect(enviar).not.toHaveBeenCalled();
  });

  it('muestra envíos aceptados sin mensaje guardado para reconciliar', async () => {
    const f = fixture();
    await f.service.despachar('org', 'chat', bot(), metodo, () =>
      Promise.resolve({ wamid: 'aceptado' }),
    );
    expect((await f.service.estado('org', 'chat')).intentos).toEqual([
      expect.objectContaining({
        estado: 'ACEPTADO',
        wamid: 'aceptado',
        mensajePersistido: false,
      }),
    ]);
    expect(f.ws.emitirAUsuarios).not.toHaveBeenCalled();
  });

  it('usa las credenciales de la línea del chat y el primer envío toma control', async () => {
    const f = fixture();
    const conversaciones = {
      findPorId: jest.fn(() =>
        Promise.resolve({
          ...f.c(),
          whatsappConexionId: 'linea-2',
          waId: '51900000000',
        }),
      ),
      registrarMensaje: jest.fn(),
    };
    const wa = {
      findPorId: jest.fn(() =>
        Promise.resolve({
          id: 'linea-2',
          phoneNumberId: 'phone-2',
          metaConexionId: 'meta-2',
        }),
      ),
    };
    const meta = {
      findActivaPorId: jest.fn(() =>
        Promise.resolve({
          id: 'meta-2',
          tokenCifrado: 'cifrado',
        }),
      ),
    };
    const graph = {
      enviarMensajeTextoWhatsApp: jest.fn(() =>
        Promise.resolve({
          wamid: 'desde-linea-2',
        }),
      ),
    };
    const uc = new EnviarMensajeWhatsAppUseCase(
      f.service,
      conversaciones as unknown as ConstructorParameters<
        typeof EnviarMensajeWhatsAppUseCase
      >[1],
      wa as unknown as ConstructorParameters<
        typeof EnviarMensajeWhatsAppUseCase
      >[2],
      meta as unknown as ConstructorParameters<
        typeof EnviarMensajeWhatsAppUseCase
      >[3],
      graph as unknown as ConstructorParameters<
        typeof EnviarMensajeWhatsAppUseCase
      >[4],
      { decrypt: () => 'token-test' } as unknown as ConstructorParameters<
        typeof EnviarMensajeWhatsAppUseCase
      >[5],
    );
    await uc.execute('org', 'chat', { texto: 'Hola' }, humano);
    expect(wa.findPorId).toHaveBeenCalledWith('org', 'linea-2');
    expect(meta.findActivaPorId).toHaveBeenCalledWith('org', 'meta-2');
    expect(graph.enviarMensajeTextoWhatsApp).toHaveBeenCalledWith(
      'phone-2',
      'token-test',
      '51900000000',
      'Hola',
      undefined,
    );
    expect(f.c().modoAtencion).toBe('HUMANO_ACTIVO');
    expect(f.intentos[0].actor).toBe('HUMAN');
  });

  it('derivar o pausar invalida salidas y no puede reemplazar una toma humana', async () => {
    const f = fixture();
    await f.service.detenerBot(
      'org',
      'chat',
      'ESPERANDO_HUMANO',
      'cliente_pide_asesor',
      0,
    );
    const enviar = jest.fn();
    await expect(
      f.service.despachar('org', 'chat', bot(), metodo, enviar),
    ).rejects.toThrow();
    const estado = await f.service.tomar(
      'org',
      'chat',
      humano,
      f.c().controlVersion,
    );
    await expect(
      f.service.detenerBot(
        'org',
        'chat',
        'PAUSADO',
        'incidente',
        estado.controlVersion,
      ),
    ).rejects.toThrow();
    expect(f.c().modoAtencion).toBe('HUMANO_ACTIVO');
    expect(enviar).not.toHaveBeenCalled();
  });
});

describe('Configuración administrativa en el gate de salida', () => {
  it('rechaza propuestas anteriores a desactivar/reactivar y permite una versión vigente', async () => {
    const f = fixture();
    const enviar = jest.fn().mockResolvedValue({ wamid: 'nuevo' });
    f.cambiarConfiguracion(false, 1);
    await expect(
      f.service.despachar('org', 'chat', bot(), metodo, enviar),
    ).rejects.toThrow(ConflictException);
    f.cambiarConfiguracion(true, 2);
    await expect(
      f.service.despachar('org', 'chat', bot(), metodo, enviar),
    ).rejects.toThrow(ConflictException);
    expect(enviar).not.toHaveBeenCalled();
    await f.service.despachar(
      'org',
      'chat',
      { ...bot('nuevo'), configVersion: 2 },
      metodo,
      enviar,
    );
    expect(enviar).toHaveBeenCalledTimes(1);
  });
  it('reactivar la organización conserva una toma humana', async () => {
    const f = fixture();
    await f.service.tomar('org', 'chat', humano, 0);
    f.cambiarConfiguracion(false, 1);
    f.cambiarConfiguracion(true, 2);
    const enviar = jest.fn();
    await expect(
      f.service.despachar(
        'org',
        'chat',
        { ...bot(), configVersion: 2, controlVersion: f.c().controlVersion },
        metodo,
        enviar,
      ),
    ).rejects.toThrow(ConflictException);
    expect(f.c().modoAtencion).toBe('HUMANO_ACTIVO');
    expect(enviar).not.toHaveBeenCalled();
  });
  it('mantiene los recordatorios de agenda con el bot deshabilitado', async () => {
    const f = fixture();
    f.cambiarConfiguracion(false, 1);
    const enviar = jest.fn().mockResolvedValue({ wamid: 'agenda' });
    await f.service.despachar(
      'org',
      'chat',
      { tipo: 'SYSTEM', origen: 'agenda_recordatorio' },
      metodo,
      enviar,
    );
    expect(enviar).toHaveBeenCalledTimes(1);
  });
  it('revocar módulo WHATSAPP bloquea BOT aunque su configuración siga habilitada', async () => {
    const f = fixture();
    f.desactivarModulo();
    const enviar = jest.fn();
    await expect(
      f.service.despachar('org', 'chat', bot(), metodo, enviar),
    ).rejects.toThrow(ConflictException);
    expect(enviar).not.toHaveBeenCalled();
  });
});

describe('Selección de asesores para transferencia', () => {
  const miembro = (id: string, rol = 'USUARIO') => ({
    usuarioId: id,
    rol,
    usuario: { id, nombre: id, apellido: null },
  });
  it('ofrece miembros del tenant con permiso sobre el lead y excluye al responsable', async () => {
    const f = fixture();
    f.c().lead = { asignadoUsuarioId: 'ana' };
    await f.service.tomar('org', 'chat', humano, 0);
    f.miembros.push(
      miembro('ana'),
      miembro('otro'),
      miembro('admin', 'ADMINISTRADOR'),
    );
    expect(
      (await f.service.asesores('org', 'chat', humano)).map((m) => m.id),
    ).toEqual(['admin']);
    expect(f.tx.organizacionUsuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizacionId: 'org',
          estado: 1,
          usuario: { estado: 1 },
          organizacion: { estado: 1 },
        },
      }),
    );
  });
  it('un chat libre puede transferirse a otro miembro activo', async () => {
    const f = fixture();
    await f.service.tomar('org', 'chat', humano, 0);
    f.miembros.push(miembro('ana'), miembro('otro'));
    expect(
      (await f.service.asesores('org', 'chat', humano)).map((m) => m.id),
    ).toEqual(['otro']);
  });
  it('no lista destinatarios mientras la toma no esté confirmada', async () => {
    const f = fixture();
    await expect(f.service.asesores('org', 'chat', humano)).rejects.toThrow(
      ConflictException,
    );
  });
  it('no expone miembros a otro tenant, miembro revocado ni asesor sin control', async () => {
    const f = fixture();
    await f.service.tomar('org', 'chat', humano, 0);
    await expect(
      f.service.asesores('otro-tenant', 'chat', humano),
    ).rejects.toThrow(NotFoundException);
    await expect(
      f.service.asesores('org', 'chat', { usuarioId: 'otro', rol: 'USUARIO' }),
    ).rejects.toThrow(ConflictException);
    f.revocar();
    await expect(f.service.asesores('org', 'chat', humano)).rejects.toThrow(
      ForbiddenException,
    );
  });
  it('el historial incluye nombres solamente de identidades presentes en los eventos', async () => {
    const f = fixture();
    f.miembros.push(miembro('ana'));
    await f.service.tomar('org', 'chat', humano, 0);
    const eventos = await f.service.historial('org', 'chat');
    expect(eventos[0].usuario?.nombre).toBe('ana');
    expect(f.tx.usuario.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['ana'] } },
      select: { id: true, nombre: true, apellido: true },
    });
  });
});

describe('Asignación explícita al bot y modo inicial', () => {
  it('devolver al bot exige acción explícita, elimina responsable y audita', async () => {
    const f = fixture();
    const tomado = await f.service.tomar(
      'org',
      'chat',
      { usuarioId: 'ana', rol: 'USUARIO' },
      0,
    );
    const result = await f.service.asignarBot(
      'org',
      'chat',
      { usuarioId: 'ana', rol: 'USUARIO' },
      tomado.controlVersion,
    );
    expect(result).toMatchObject({
      modoAtencion: 'BOT_ACTIVO',
      controlUsuarioId: null,
    });
    expect(result.controlVersion).toBeGreaterThan(tomado.controlVersion);
    expect(f.eventos.at(-1)).toMatchObject({
      motivo: 'asignacion_bot_explicita',
      actor: 'HUMAN',
      usuarioId: 'ana',
    });
  });
  it('otro asesor no devuelve un chat ajeno al bot', async () => {
    const f = fixture();
    const tomado = await f.service.tomar(
      'org',
      'chat',
      { usuarioId: 'ana', rol: 'USUARIO' },
      0,
    );
    await expect(
      f.service.asignarBot(
        'org',
        'chat',
        { usuarioId: 'otro', rol: 'USUARIO' },
        tomado.controlVersion,
      ),
    ).rejects.toThrow(ConflictException);
  });
  it('versiones viejas no devuelven al bot ni cambian control', async () => {
    const f = fixture();
    const tomado = await f.service.tomar(
      'org',
      'chat',
      { usuarioId: 'ana', rol: 'USUARIO' },
      0,
    );
    await expect(
      f.service.asignarBot(
        'org',
        'chat',
        { usuarioId: 'ana', rol: 'USUARIO' },
        0,
      ),
    ).rejects.toThrow(ConflictException);
    expect((await f.service.estado('org', 'chat')).controlVersion).toBe(
      tomado.controlVersion,
    );
  });
  it('un envío humano en curso bloquea la devolución al bot', async () => {
    const f = fixture();
    const tomado = await f.service.tomar(
      'org',
      'chat',
      { usuarioId: 'ana', rol: 'USUARIO' },
      0,
    );
    f.intentos.push({
      id: 'pendiente',
      actor: 'HUMAN',
      estado: 'DESPACHANDO',
      organizacionId: 'org',
      conversacionId: 'chat',
    });
    await expect(
      f.service.asignarBot(
        'org',
        'chat',
        { usuarioId: 'ana', rol: 'USUARIO' },
        tomado.controlVersion,
      ),
    ).rejects.toThrow(ConflictException);
  });
  it('un modo inicial BOT solo cambia un chat nuevo e intacto', async () => {
    const f = fixture();
    f.c().modoAtencion = 'MANUAL';
    await f.service.aplicarModoInicial('org', 'chat');
    expect(f.c().modoAtencion).toBe('BOT_ACTIVO');
    expect(f.eventos.at(-1)).toMatchObject({
      motivo: 'modo_inicial_empresa',
      actor: 'SYSTEM',
    });
    const tomado = await f.service.tomar(
      'org',
      'chat',
      { usuarioId: 'ana', rol: 'USUARIO' },
      f.c().controlVersion,
    );
    await f.service.aplicarModoInicial('org', 'chat');
    expect(f.c().controlVersion).toBe(tomado.controlVersion);
    expect(f.c().modoAtencion).toBe('HUMANO_ACTIVO');
  });
  it('integración no operativa mantiene los chats nuevos manuales', async () => {
    const f = fixture();
    f.c().modoAtencion = 'MANUAL';
    f.bot.integracion.mockReturnValue({ operativa: false });
    await f.service.aplicarModoInicial('org', 'chat');
    expect(f.c().modoAtencion).toBe('MANUAL');
    expect(f.eventos).toHaveLength(0);
  });
});

describe('Tomar chat humano sin confundirlo con intervención del bot', () => {
  function humano() {
    const f = fixture();
    f.c().modoAtencion = 'MANUAL';
    f.c().leadId = 'lead';
    f.c().lead = { asignadoUsuarioId: 'david' };
    return f;
  }
  it('admin toma el chat y reasigna su lead en una misma operación auditada', async () => {
    const f = humano();
    await f.service.asumirHumano(
      'org',
      'chat',
      { usuarioId: 'admin', rol: 'ADMINISTRADOR' },
      0,
      'david',
    );
    expect(f.c()).toMatchObject({
      modoAtencion: 'HUMANO_ACTIVO',
      controlUsuarioId: 'admin',
      controlVersion: 1,
      lead: { asignadoUsuarioId: 'admin' },
    });
    expect(f.eventos[0]).toMatchObject({
      motivo: 'toma_chat_humano',
      usuarioId: 'admin',
    });
  });
  it('otro asesor no puede quitar la asignación de David', async () => {
    const f = humano();
    await expect(
      f.service.asumirHumano(
        'org',
        'chat',
        { usuarioId: 'otro', rol: 'USUARIO' },
        0,
        'david',
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(f.tx.lead.updateMany).not.toHaveBeenCalled();
  });
  it('rechaza asignación obsoleta aunque la versión de atención no haya cambiado', async () => {
    const f = humano();
    f.c().lead!.asignadoUsuarioId = 'geraldine';
    await expect(
      f.service.asumirHumano(
        'org',
        'chat',
        { usuarioId: 'admin', rol: 'ADMINISTRADOR' },
        0,
        'david',
      ),
    ).rejects.toThrow(ConflictException);
    expect(f.tx.lead.updateMany).not.toHaveBeenCalled();
  });
  it('envíos humanos en curso impiden desplazar al responsable', async () => {
    const f = humano();
    f.intentos.push({
      id: 'pending',
      organizacionId: 'org',
      conversacionId: 'chat',
      actor: 'HUMAN',
      estado: 'DESPACHANDO',
    });
    await expect(
      f.service.asumirHumano(
        'org',
        'chat',
        { usuarioId: 'admin', rol: 'ADMINISTRADOR' },
        0,
        'david',
      ),
    ).rejects.toThrow(ConflictException);
    expect(f.tx.lead.updateMany).not.toHaveBeenCalled();
  });
  it('la toma del asesor no acepta atención BOT ni altera el lead si falla su comparación', async () => {
    const f = humano();
    f.c().modoAtencion = 'BOT_ACTIVO';
    await expect(
      f.service.asumirHumano(
        'org',
        'chat',
        { usuarioId: 'admin', rol: 'ADMINISTRADOR' },
        0,
        'david',
      ),
    ).rejects.toThrow(ConflictException);
    f.c().modoAtencion = 'MANUAL';
    f.tx.lead.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      f.service.asumirHumano(
        'org',
        'chat',
        { usuarioId: 'admin', rol: 'ADMINISTRADOR' },
        0,
        'david',
      ),
    ).rejects.toThrow(ConflictException);
    expect(f.c().controlVersion).toBe(0);
    expect(f.eventos).toHaveLength(0);
  });
});
