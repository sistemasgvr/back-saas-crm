import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import { extraerVariablesPlantilla } from '../extraer-variables-plantilla';

export interface CrearPlantillaInput {
  nombre: string;
  categoria: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
  idioma: string;
  /** Puede incluir variables con nombre {{nombre_cliente}}, {{numero_pedido}}…
   * (no {{1}}, {{2}} — este CRM solo crea plantillas con formato "named"). */
  cuerpo: string;
  /** Un ejemplo por cada variable de `cuerpo`, en el mismo orden en que
   * aparecen por primera vez — Meta exige un ejemplo por variable. */
  ejemplosCuerpo?: string[];
  encabezado?: string;
  /** Ejemplo de la única variable que puede tener el encabezado (límite de Meta). */
  ejemploEncabezado?: string;
  pie?: string;
}

/** Envía la plantilla a revisión de Meta — queda PENDING hasta que la
 * aprueben (horas a días); recién ahí aparece en el selector de envío
 * (ListarPlantillasUseCase ya filtra por APPROVED).
 *
 * Usa siempre parámetros CON NOMBRE ({{nombre_cliente}}, no {{1}}) — así
 * quien crea la plantilla sabe, con solo mirar el texto, qué valor va en
 * cada variable, sin tener que contar posiciones (WhatsApp Business
 * Platform docs, "Aspectos básicos de las plantillas", vigente en v26). */
@Injectable()
export class CrearPlantillaUseCase {
  constructor(
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly whatsappConexiones: WhatsappConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(organizacionId: string, input: CrearPlantillaInput) {
    const cuerpo = extraerVariablesPlantilla(input.cuerpo);
    if (cuerpo.invalidas.length > 0) {
      throw new BadRequestException(
        `Variable inválida {{${cuerpo.invalidas[0]}}} en el mensaje — el nombre debe ser minúsculas, ` +
          `números y guiones bajos, empezando con una letra (ej. {{nombre_cliente}})`,
      );
    }
    if (cuerpo.validas.length > 0) {
      const ejemplos = input.ejemplosCuerpo ?? [];
      // No alcanza con que la CANTIDAD coincida — cada ejemplo tiene que
      // traer contenido real (Meta rechaza ejemplos vacíos/en blanco, y esta
      // es la única capa que protege contra alguien pegándole al endpoint
      // directo sin pasar por el formulario, que ya valida esto).
      const faltaAlguno =
        ejemplos.length !== cuerpo.validas.length ||
        ejemplos.some((e) => !e?.trim());
      if (faltaAlguno) {
        throw new BadRequestException(
          `El mensaje usa ${cuerpo.validas.length} variable(s) (${cuerpo.validas
            .map((n) => `{{${n}}}`)
            .join(', ')}) — hace falta un ejemplo con contenido por cada una`,
        );
      }
    }

    const encabezado = extraerVariablesPlantilla(input.encabezado);
    if (encabezado.invalidas.length > 0) {
      throw new BadRequestException(
        `Variable inválida {{${encabezado.invalidas[0]}}} en el encabezado — usa minúsculas, ` +
          `números y guiones bajos, empezando con una letra (ej. {{nombre_cliente}})`,
      );
    }
    if (encabezado.validas.length > 1) {
      throw new BadRequestException(
        'El encabezado solo admite una variable — es un límite de Meta',
      );
    }
    if (encabezado.validas.length === 1 && !input.ejemploEncabezado?.trim()) {
      throw new BadRequestException(
        `El encabezado usa {{${encabezado.validas[0]}}} — hace falta un ejemplo con contenido`,
      );
    }

    const [conexion, numeros] = await Promise.all([
      this.conexiones.findActivaPorOrganizacion(organizacionId),
      this.whatsappConexiones.listarPorOrganizacion(organizacionId),
    ]);
    if (!conexion?.tokenCifrado) {
      throw new NotFoundException(
        'No hay una sesión de Meta conectada para esta organización',
      );
    }
    const wabaId = numeros[0]?.wabaId;
    if (!wabaId) {
      throw new NotFoundException(
        'No hay un número de WhatsApp vinculado a esta organización',
      );
    }

    const accessToken = this.tokenEncryption.decrypt(conexion.tokenCifrado);
    await this.graph.crearPlantillaWhatsApp(wabaId, accessToken, {
      nombre: input.nombre,
      categoria: input.categoria,
      idioma: input.idioma,
      cuerpo: input.cuerpo,
      variablesCuerpo: cuerpo.validas.map((nombre, i) => ({
        nombre,
        ejemplo: input.ejemplosCuerpo![i].trim(),
      })),
      encabezado: input.encabezado,
      variableEncabezado: encabezado.validas[0]
        ? {
            nombre: encabezado.validas[0],
            ejemplo: input.ejemploEncabezado!.trim(),
          }
        : undefined,
      pie: input.pie,
    });
  }
}
