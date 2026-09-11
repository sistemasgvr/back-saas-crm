import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ProcesarCallbackMetaUsuarioUseCase } from '../application/use-cases/procesar-callback-meta-usuario.use-case';
import { ObtenerEstadoEliminacionDatosUseCase } from '../application/use-cases/obtener-estado-eliminacion-datos.use-case';

/**
 * Endpoints públicos para Meta App Review:
 * - Data Deletion Callback
 * - Deauthorize Callback
 * - Consulta de estado por confirmation_code
 */
@Controller('meta')
export class MetaDataDeletionController {
  constructor(
    private readonly procesarCallback: ProcesarCallbackMetaUsuarioUseCase,
    private readonly obtenerEstado: ObtenerEstadoEliminacionDatosUseCase,
  ) {}

  @Post('data-deletion')
  @HttpCode(200)
  dataDeletion(@Body('signed_request') signedRequest: string | undefined) {
    return this.procesarCallback.execute(signedRequest, 'DATA_DELETION');
  }

  @Post('deauthorize')
  @HttpCode(200)
  deauthorize(@Body('signed_request') signedRequest: string | undefined) {
    return this.procesarCallback.execute(signedRequest, 'DEAUTHORIZE');
  }

  @Get('data-deletion/status/:codigo')
  status(@Param('codigo') codigo: string) {
    if (!codigo?.trim()) {
      throw new BadRequestException('Código requerido');
    }
    return this.obtenerEstado.execute(codigo);
  }
}
