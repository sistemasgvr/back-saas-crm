import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma.service';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { META_GRAPH_CLIENT } from '../../../connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../connections/application/ports/meta-graph-client.port';

@Injectable()
export class DiagnosticarRecepcionCuentaUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: TokenEncryptionService,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
  ) {}

  async execute(organizacionId: string, id: string) {
    const cuenta = await this.prisma.metaCuentaPublicitaria.findFirst({
      where: { id, organizacionId, estado: 1 },
      include: { metaConexion: true },
    });
    if (!cuenta)
      throw new NotFoundException('Cuenta publicitaria no encontrada');
    const conexion = cuenta.metaConexion;
    if (!conexion.tokenCifrado || conexion.estado !== 1 || !conexion.appId)
      throw new NotFoundException(
        'No hay una sesión activa de Meta para esta cuenta',
      );
    const token = this.encryption.decrypt(conexion.tokenCifrado);
    const paginas = [] as {
      id: string;
      nombre: string;
      importacion: boolean;
      suscrito: boolean | null;
      formularios: {
        formId: string;
        nombre: string;
        sincronizado: boolean;
        importacion: boolean | null;
        leadsMeta: number | null;
        leadsCRM: number;
        error: string | null;
      }[];
      error: string | null;
    }[];
    for (const pagina of await this.prisma.metaPagina.findMany({
      where: { organizacionId, metaConexionId: conexion.id, estado: 1 },
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
    })) {
      const resultado: (typeof paginas)[number] = {
        id: pagina.id,
        nombre: pagina.nombre,
        importacion: pagina.importarLeadsAutomaticamente,
        suscrito: null,
        formularios: [],
        error: null,
      };
      try {
        const pageToken = await this.graph.obtenerAccessTokenPagina(
          pagina.pageId,
          token,
        );
        if (!pageToken)
          throw new Error('No se pudo obtener acceso a la página');
        const [apps, forms] = await Promise.allSettled([
          this.graph.obtenerAppsSuscritas(pagina.pageId, pageToken),
          this.graph.listarLeadgenForms(pagina.pageId, pageToken),
        ]);
        if (apps.status === 'fulfilled')
          resultado.suscrito = apps.value.some(
            (a) =>
              a.id === conexion.appId && a.camposSuscritos.includes('leadgen'),
          );
        else
          resultado.error =
            'No se pudo verificar la suscripción en Meta. Revisa los permisos y vuelve a consultar.';
        if (forms.status === 'rejected')
          resultado.error = [
            resultado.error,
            'No se pudo obtener el catálogo completo de formularios de Meta.',
          ]
            .filter(Boolean)
            .join(' ');
        else
          for (const form of forms.value) {
            const [local, leadsCRM, conteo] = await Promise.all([
              this.prisma.metaFormulario.findFirst({
                where: {
                  organizacionId,
                  metaPaginaId: pagina.id,
                  formId: form.id,
                  estado: 1,
                },
              }),
              this.prisma.lead.count({
                where: {
                  organizacionId,
                  metaPaginaId: pagina.id,
                  formularioId: form.id,
                  estado: 1,
                },
              }),
              this.graph.contarLeadsDeForm(form.id, pageToken).then(
                (n) => ({ total: n, error: null }),
                () => ({
                  total: null,
                  error: 'No se pudo consultar el total en Meta',
                }),
              ),
            ]);
            resultado.formularios.push({
              formId: form.id,
              nombre: form.nombre,
              sincronizado: !!local,
              importacion: local?.importarLeadsAutomaticamente ?? null,
              leadsMeta: conteo.total,
              leadsCRM,
              error: conteo.error,
            });
          }
      } catch {
        resultado.error =
          'No se pudo consultar esta página. Revisa el acceso y los permisos de Meta.';
      }
      paginas.push(resultado);
    }

    const whatsapp = [] as {
      id: string;
      nombre: string;
      suscrito: boolean | null;
      ultimoMensajeEntranteEn: Date | null;
      error: string | null;
    }[];
    for (const linea of await this.prisma.whatsappConexion.findMany({
      where: { organizacionId, metaConexionId: conexion.id, estado: 1 },
    })) {
      const [apps, ultimo] = await Promise.allSettled([
        this.graph.obtenerAppsSuscritasWaba(linea.wabaId, token),
        this.prisma.whatsappMensaje.aggregate({
          where: {
            organizacionId,
            direccion: 'entrante',
            whatsappConversacion: {
              organizacionId,
              whatsappConexionId: linea.id,
            },
          },
          _max: { fechaMensaje: true },
        }),
      ]);
      whatsapp.push({
        id: linea.id,
        nombre: linea.nombreVerificado ?? 'Línea de WhatsApp',
        suscrito:
          apps.status === 'fulfilled'
            ? apps.value.some((a) => a.id === conexion.appId)
            : null,
        ultimoMensajeEntranteEn:
          ultimo.status === 'fulfilled' ? ultimo.value._max.fechaMensaje : null,
        error:
          apps.status === 'rejected' || ultimo.status === 'rejected'
            ? 'No se pudo completar la verificación de esta línea.'
            : null,
      });
    }
    return {
      verificadoEn: new Date().toISOString(),
      paginas,
      whatsapp,
      aviso:
        'La suscripción confirma la configuración en Meta; no garantiza la entrega de cada evento. Los resultados de mensajes se revisan en WhatsApp. Un resultado publicitario no siempre equivale a un nuevo lead.',
    };
  }
}
