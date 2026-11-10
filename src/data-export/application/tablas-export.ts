/**
 * Qué se exporta de cada sección. Lista explícita de columnas: nunca se
 * exportan tokens, contraseñas ni payloads crudos de webhooks (datosCrudos),
 * salvo en leads, donde datosCrudos guarda las respuestas del formulario.
 *
 * Cada columna lleva el título que verá el cliente en Excel / Power BI. Los
 * "ID ..." usan el mismo nombre en todos los archivos para que Power BI
 * detecte solo las relaciones (ej. "ID lead" en leads.csv y en visitas.csv).
 */
export const SECCIONES_EXPORT = [
  'leads',
  'chats',
  // TODO(llamadas): reactivar cuando el módulo de llamadas esté en uso.
  // 'llamadas',
  'inmuebles',
  'campanas',
  'usuarios',
] as const;

export type SeccionExport = (typeof SECCIONES_EXPORT)[number];

/** Nombre del delegate de Prisma (prisma.<modelo>). Todos tienen id + organizacionId. */
export type ModeloExport =
  | 'lead'
  | 'leadEstadoHistorial'
  | 'leadVisita'
  | 'leadActividad'
  | 'leadCalificacion'
  | 'whatsappConversacion'
  | 'whatsappMensaje'
  | 'whatsappLlamada'
  | 'inmueble'
  | 'campana'
  | 'conjuntoAnuncio'
  | 'anuncio'
  | 'metaFormulario'
  | 'metaInsightDiario'
  | 'organizacionUsuario';

/**
 * [campo de Prisma, título visible, tipo]. `dia` = fecha sin hora (@db.Date):
 * se escribe tal cual, sin convertir a la zona horaria de la empresa.
 */
export type ColumnaExport = readonly [
  campo: string,
  titulo: string,
  tipo?: 'dia',
];

export interface TablaExport {
  archivo: string;
  modelo: ModeloExport;
  columnas: readonly ColumnaExport[];
  /** Select de Prisma; por defecto { campo: true } por cada columna. */
  select?: Record<string, unknown>;
  /** Convierte la fila al orden de `columnas`; por defecto fila[campo]. */
  mapear?: (fila: Record<string, unknown>) => unknown[];
}

const ESTADO_REGISTRO: ColumnaExport = [
  'estado',
  'Registro activo (1 = sí, 0 = no)',
];
const CREADO: ColumnaExport = ['fechaCreacion', 'Fecha de creación'];
const MODIFICADO: ColumnaExport = ['fechaModificacion', 'Última modificación'];

export const TABLAS_POR_SECCION: Record<SeccionExport, readonly TablaExport[]> =
  {
    leads: [
      {
        archivo: 'leads/leads.csv',
        modelo: 'lead',
        columnas: [
          ['id', 'ID lead'],
          ['nombre', 'Nombre'],
          ['email', 'Correo'],
          ['telefono', 'Teléfono'],
          ['origen', 'Origen'],
          ['tipoLead', 'Tipo de lead'],
          ['estadoGestion', 'Etapa'],
          ['estadoGestionEn', 'Fecha de cambio de etapa'],
          ['motivoCierre', 'Motivo de cierre'],
          ['notaCierre', 'Nota de cierre'],
          ['asignadoUsuarioId', 'ID usuario asignado'],
          ['asignadoEn', 'Fecha de asignación'],
          ['inmuebleInteresId', 'ID inmueble de interés'],
          ['campanaId', 'ID campaña'],
          ['conjuntoAnuncioId', 'ID conjunto de anuncios'],
          ['anuncioId', 'ID anuncio'],
          ['formularioId', 'ID formulario'],
          ['idExterno', 'ID en Meta'],
          ['fechaLead', 'Fecha del lead'],
          ['datosCrudos', 'Respuestas del formulario'],
          ESTADO_REGISTRO,
          CREADO,
          MODIFICADO,
        ],
      },
      {
        archivo: 'leads/historial_etapas.csv',
        modelo: 'leadEstadoHistorial',
        columnas: [
          ['id', 'ID cambio'],
          ['leadId', 'ID lead'],
          ['tipoLead', 'Tipo de lead'],
          ['desde', 'Etapa anterior'],
          ['hacia', 'Etapa nueva'],
          ['motivoCierre', 'Motivo de cierre'],
          ['nota', 'Nota'],
          ['usuarioId', 'ID usuario'],
          ['fechaCreacion', 'Fecha del cambio'],
        ],
      },
      {
        archivo: 'leads/visitas.csv',
        modelo: 'leadVisita',
        columnas: [
          ['id', 'ID visita'],
          ['leadId', 'ID lead'],
          ['programadaEn', 'Inicio'],
          ['programadaFin', 'Fin'],
          ['duracionMinutos', 'Duración (minutos)'],
          ['referenciaInmueble', 'Inmueble (referencia)'],
          ['inmuebleId', 'ID inmueble'],
          ['direccion', 'Dirección'],
          ['modalidad', 'Modalidad'],
          ['puntoEncuentro', 'Punto de encuentro'],
          ['estado', 'Estado de la visita'],
          ['resultado', 'Resultado'],
          ['nota', 'Nota'],
          ['feedback', 'Comentario del cliente'],
          ['asignadoUsuarioId', 'ID usuario asignado'],
          ['creadoPorUsuarioId', 'ID usuario que la creó'],
          CREADO,
          MODIFICADO,
        ],
      },
      {
        archivo: 'leads/actividades.csv',
        modelo: 'leadActividad',
        columnas: [
          ['id', 'ID actividad'],
          ['leadId', 'ID lead'],
          ['tipo', 'Tipo'],
          ['titulo', 'Título'],
          ['programadaEn', 'Inicio'],
          ['programadaFin', 'Fin'],
          ['duracionMinutos', 'Duración (minutos)'],
          ['referenciaInmueble', 'Inmueble (referencia)'],
          ['modalidad', 'Modalidad'],
          ['estado', 'Estado de la actividad'],
          ['nota', 'Nota'],
          ['asignadoUsuarioId', 'ID usuario asignado'],
          ['creadoPorUsuarioId', 'ID usuario que la creó'],
          CREADO,
          MODIFICADO,
        ],
      },
      {
        archivo: 'leads/calificaciones.csv',
        modelo: 'leadCalificacion',
        columnas: [
          ['id', 'ID calificación'],
          ['leadId', 'ID lead'],
          ['tipoLead', 'Tipo de lead'],
          ['presupuesto', 'Presupuesto'],
          ['zona', 'Zona'],
          ['tipoInmueble', 'Tipo de inmueble'],
          ['tipoPropiedad', 'Tipo de propiedad'],
          ['precioReferencia', 'Precio de referencia'],
          ['nota', 'Nota'],
          ['usuarioId', 'ID usuario'],
          ['fechaCreacion', 'Fecha'],
        ],
      },
    ],
    chats: [
      {
        archivo: 'chats/conversaciones.csv',
        modelo: 'whatsappConversacion',
        columnas: [
          ['id', 'ID conversación'],
          ['leadId', 'ID lead'],
          ['nombreContacto', 'Contacto'],
          ['waId', 'Número de WhatsApp'],
          ['username', 'Usuario de WhatsApp'],
          ['ultimoMensajeEn', 'Último mensaje'],
          ['noLeidos', 'Mensajes sin leer'],
          ['bloqueado', 'Bloqueado (1 = sí)'],
          ['modoAtencion', 'Modo de atención'],
          ESTADO_REGISTRO,
          CREADO,
          MODIFICADO,
        ],
      },
      {
        archivo: 'chats/mensajes.csv',
        modelo: 'whatsappMensaje',
        columnas: [
          ['id', 'ID mensaje'],
          ['whatsappConversacionId', 'ID conversación'],
          ['fechaMensaje', 'Fecha'],
          ['direccion', 'Entrante / saliente'],
          ['autorTipo', 'Enviado por'],
          ['tipo', 'Tipo de mensaje'],
          ['texto', 'Texto'],
          ['plantillaNombre', 'Plantilla'],
          ['mediaNombreArchivo', 'Nombre del archivo'],
          ['mediaMimeType', 'Tipo de archivo'],
          ['mediaCaption', 'Descripción del archivo'],
          ['mediaTamanoBytes', 'Tamaño del archivo (bytes)'],
          ['estadoEntrega', 'Estado de entrega'],
          ['errorMensaje', 'Error de envío'],
          ['reaccionAgente', 'Reacción del asesor'],
          ['reaccionCliente', 'Reacción del cliente'],
          ['respondeAMensajeId', 'Responde al mensaje (ID)'],
          ['ubicacionLatitud', 'Ubicación: latitud'],
          ['ubicacionLongitud', 'Ubicación: longitud'],
          ['ubicacionNombre', 'Ubicación: nombre'],
          ['ubicacionDireccion', 'Ubicación: dirección'],
          ['contactos', 'Contactos compartidos'],
          ['usuarioCreacion', 'ID usuario que envió'],
          ['fechaEdicion', 'Fecha de edición'],
        ],
      },
    ],
    // TODO(llamadas): reactivar junto con la sección en SECCIONES_EXPORT.
    // llamadas: [
    //   {
    //     archivo: 'llamadas/llamadas.csv',
    //     modelo: 'whatsappLlamada',
    //     columnas: [
    //       ['id', 'ID llamada'],
    //       ['conversacionId', 'ID conversación'],
    //       ['leadId', 'ID lead'],
    //       ['asignadoUsuarioId', 'ID usuario asignado'],
    //       ['waId', 'Número de WhatsApp'],
    //       ['direccion', 'Entrante / saliente'],
    //       ['estado', 'Estado de la llamada'],
    //       ['resultado', 'Resultado'],
    //       ['inicioEn', 'Inicio'],
    //       ['contestadaEn', 'Contestada'],
    //       ['finEn', 'Fin'],
    //       ['duracionSeg', 'Duración (segundos)'],
    //       ['notaPostLlamada', 'Nota'],
    //       ['motivo', 'Motivo'],
    //       ['errorCodigo', 'Código de error'],
    //       ['errorMensaje', 'Error'],
    //       CREADO,
    //       MODIFICADO,
    //     ],
    //   },
    // ],
    inmuebles: [
      {
        archivo: 'inmuebles/inmuebles.csv',
        modelo: 'inmueble',
        columnas: [
          ['id', 'ID inmueble'],
          ['codigo', 'Código'],
          ['titulo', 'Título'],
          ['tipo', 'Tipo'],
          ['operacion', 'Operación'],
          ['zona', 'Zona'],
          ['direccion', 'Dirección'],
          ['precio', 'Precio'],
          ['moneda', 'Moneda'],
          ['estadoInmueble', 'Disponibilidad'],
          ['notas', 'Notas'],
          ESTADO_REGISTRO,
          CREADO,
          MODIFICADO,
        ],
      },
    ],
    campanas: [
      {
        archivo: 'campanas/campanas.csv',
        modelo: 'campana',
        columnas: [
          ['id', 'ID campaña'],
          ['nombre', 'Campaña'],
          ['metaCampanaId', 'ID campaña en Meta'],
          ['estadoMeta', 'Estado en Meta'],
          ESTADO_REGISTRO,
          CREADO,
          MODIFICADO,
        ],
      },
      {
        archivo: 'campanas/conjuntos_anuncios.csv',
        modelo: 'conjuntoAnuncio',
        columnas: [
          ['id', 'ID conjunto de anuncios'],
          ['campanaId', 'ID campaña'],
          ['nombre', 'Conjunto de anuncios'],
          ['metaConjuntoId', 'ID conjunto en Meta'],
          ['estadoMeta', 'Estado en Meta'],
          ESTADO_REGISTRO,
          CREADO,
          MODIFICADO,
        ],
      },
      {
        archivo: 'campanas/anuncios.csv',
        modelo: 'anuncio',
        columnas: [
          ['id', 'ID anuncio'],
          ['conjuntoAnuncioId', 'ID conjunto de anuncios'],
          ['nombre', 'Anuncio'],
          ['metaAnuncioId', 'ID anuncio en Meta'],
          ['estadoMeta', 'Estado en Meta'],
          ESTADO_REGISTRO,
          CREADO,
          MODIFICADO,
        ],
      },
      {
        archivo: 'campanas/formularios.csv',
        modelo: 'metaFormulario',
        columnas: [
          ['id', 'ID formulario'],
          ['nombre', 'Formulario'],
          ['formId', 'ID formulario en Meta'],
          ['estadoMeta', 'Estado en Meta'],
          ['locale', 'Idioma'],
          ['ultimoSyncEn', 'Última sincronización'],
          ESTADO_REGISTRO,
          CREADO,
          MODIFICADO,
        ],
      },
      {
        archivo: 'campanas/metricas_diarias.csv',
        modelo: 'metaInsightDiario',
        columnas: [
          ['id', 'ID métrica'],
          ['campanaId', 'ID campaña'],
          ['fecha', 'Día', 'dia'],
          ['spend', 'Inversión'],
          ['moneda', 'Moneda'],
          ['impressions', 'Impresiones'],
          ['reach', 'Alcance'],
          ['clicks', 'Clics'],
          ['ctr', 'CTR (%)'],
          ['cpc', 'Costo por clic'],
        ],
      },
    ],
    usuarios: [
      {
        archivo: 'usuarios/usuarios.csv',
        modelo: 'organizacionUsuario',
        columnas: [
          ['usuarioId', 'ID usuario'],
          ['email', 'Correo'],
          ['nombre', 'Nombre'],
          ['apellido', 'Apellido'],
          ['telefono', 'Teléfono'],
          ['rol', 'Rol'],
          ESTADO_REGISTRO,
          ['fechaCreacion', 'Fecha de alta'],
        ],
        select: {
          usuarioId: true,
          rol: true,
          estado: true,
          fechaCreacion: true,
          // Solo datos de contacto: nunca passwordHash ni tokens.
          usuario: {
            select: {
              email: true,
              nombre: true,
              apellido: true,
              telefono: true,
            },
          },
        },
        mapear: (fila) => {
          const u = (fila.usuario ?? {}) as Record<string, unknown>;
          return [
            fila.usuarioId,
            u.email,
            u.nombre,
            u.apellido,
            u.telefono,
            fila.rol,
            fila.estado,
            fila.fechaCreacion,
          ];
        },
      },
    ],
  };
