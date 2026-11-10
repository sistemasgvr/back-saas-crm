import { Module } from '@nestjs/common';
import { ExportarDatosService } from './application/exportar-datos.service';
import { ExportarDatosController } from './presentation/exportar-datos.controller';

/** Exportación de datos de la empresa (portabilidad / cierre de cuenta). */
@Module({
  controllers: [ExportarDatosController],
  providers: [ExportarDatosService],
})
export class DataExportModule {}
