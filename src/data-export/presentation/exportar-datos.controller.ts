import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../shared/presentation/guards/org-membership.guard';
import { PermisosGuard } from '../../shared/presentation/guards/permisos.guard';
import { RequirePermission } from '../../shared/presentation/decorators/require-permission.decorator';
import { ExportarDatosService } from '../application/exportar-datos.service';
import { ExportarDatosQueryDto } from './exportar-datos.query.dto';

@ApiTags('Organizations')
@ApiBearerAuth('JWT-auth')
@Controller('organizations/current/export')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, PermisosGuard)
export class ExportarDatosController {
  constructor(private readonly exportador: ExportarDatosService) {}

  @Get()
  // Exporta TODA la empresa (incluye datos de clientes): permiso explícito.
  @RequirePermission('empresa.exportar')
  @ApiOperation({
    summary:
      'Descargar un ZIP con los datos de la empresa en CSV (y opcionalmente los archivos de WhatsApp).',
  })
  async exportar(
    @CurrentUser() ctx: RequestContext,
    @Query() query: ExportarDatosQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const opciones = {
      organizacionId: ctx.organizacionId!,
      usuarioId: ctx.usuarioId,
      secciones: query.secciones,
      incluirMedios: query.medios === true,
    };
    const estimado = await this.exportador.estimarBytes(opciones);
    const fecha = new Date().toISOString().slice(0, 10);
    res.status(200);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="exportacion-crm-${fecha}.zip"`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Tamaño aproximado para la barra de avance (el ZIP no tiene Content-Length).
    res.setHeader('X-Export-Estimado', String(estimado));
    await this.exportador.exportar(opciones, res);
  }
}
