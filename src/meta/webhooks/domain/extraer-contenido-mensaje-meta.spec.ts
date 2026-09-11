import {
  extraerContenidoMensajeMeta,
  recuperarTextoDesdeDatosCrudos,
} from './extraer-contenido-mensaje-meta';

describe('extraerContenidoMensajeMeta', () => {
  it('extrae text.body', () => {
    expect(
      extraerContenidoMensajeMeta({
        type: 'text',
        text: { body: 'Hola' },
      }),
    ).toEqual({ tipo: 'text', texto: 'Hola' });
  });

  it('extrae button.text (quick reply de plantilla)', () => {
    expect(
      extraerContenidoMensajeMeta({
        type: 'button',
        button: { text: 'Sí, me interesa', payload: 'SI' },
      }),
    ).toEqual({ tipo: 'button', texto: 'Sí, me interesa' });
  });

  it('extrae interactive button_reply', () => {
    expect(
      extraerContenidoMensajeMeta({
        type: 'interactive',
        interactive: {
          type: 'button_reply',
          button_reply: { id: '1', title: 'Comprar' },
        },
      }),
    ).toEqual({ tipo: 'button_reply', texto: 'Comprar' });
  });

  it('extrae interactive list_reply', () => {
    expect(
      extraerContenidoMensajeMeta({
        type: 'interactive',
        interactive: {
          type: 'list_reply',
          list_reply: {
            id: 'a',
            title: 'Depto 2D',
            description: 'Miraflores',
          },
        },
      }),
    ).toEqual({ tipo: 'list_reply', texto: 'Depto 2D — Miraflores' });
  });

  it('extrae nfm_reply con response_json', () => {
    const r = extraerContenidoMensajeMeta({
      type: 'interactive',
      interactive: {
        type: 'nfm_reply',
        nfm_reply: {
          name: 'lead_form',
          body: 'Sent',
          response_json: '{"nombre":"Ana","telefono":"999"}',
        },
      },
    });
    expect(r.tipo).toBe('nfm_reply');
    expect(r.texto).toContain('Ana');
    expect(r.texto).toContain('999');
  });

  it('extrae caption de imagen', () => {
    expect(
      extraerContenidoMensajeMeta({
        type: 'image',
        image: { caption: 'Foto del depto' },
      }),
    ).toEqual({ tipo: 'image', texto: 'Foto del depto' });
  });

  it('marca unsupported con detalle', () => {
    const r = extraerContenidoMensajeMeta({
      type: 'unsupported',
      unsupported: { type: 'poll_creation' },
      errors: [
        {
          code: 131051,
          title: 'Message type unknown',
          message: 'Message type is currently not supported.',
        },
      ],
    });
    expect(r.tipo).toBe('unsupported');
    expect(r.texto).toContain('no soportado');
  });

  it('recupera desde datos_crudos', () => {
    expect(
      recuperarTextoDesdeDatosCrudos({
        type: 'button',
        button: { text: 'Ok' },
      }),
    ).toBe('Ok');
  });
});
