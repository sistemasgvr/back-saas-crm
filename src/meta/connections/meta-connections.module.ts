import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { MetaOAuthController } from './presentation/meta-oauth.controller';
import { MetaConnectionsController } from './presentation/meta-connections.controller';
import { ObtenerUrlOAuthUseCase } from './application/use-cases/obtener-url-oauth.use-case';
import { ProcesarCallbackOAuthUseCase } from './application/use-cases/procesar-callback-oauth.use-case';
import { ObtenerConexionActualUseCase } from './application/use-cases/obtener-conexion-actual.use-case';
import { ListarPaginasUseCase } from './application/use-cases/listar-paginas.use-case';
import { ListarCuentasPublicitariasUseCase } from './application/use-cases/listar-cuentas-publicitarias.use-case';
import { SeleccionarPaginaUseCase } from './application/use-cases/seleccionar-pagina.use-case';
import { SeleccionarCuentaPublicitariaUseCase } from './application/use-cases/seleccionar-cuenta-publicitaria.use-case';
import { DesconectarUseCase } from './application/use-cases/desconectar.use-case';
import { META_CONEXIONES_REPOSITORY } from './application/ports/meta-conexiones.repository.port';
import { PrismaMetaConexionesRepository } from './infrastructure/prisma-meta-conexiones.repository';
import { META_GRAPH_CLIENT } from './application/ports/meta-graph-client.port';
import { AxiosMetaGraphClient } from './infrastructure/meta-graph.client';
import { META_OAUTH_STATE_SERVICE } from './application/ports/meta-oauth-state.port';
import { JwtMetaOAuthStateService } from './infrastructure/jwt-meta-oauth-state.service';

@Module({
  imports: [HttpModule, JwtModule.register({})],
  controllers: [MetaOAuthController, MetaConnectionsController],
  providers: [
    ObtenerUrlOAuthUseCase,
    ProcesarCallbackOAuthUseCase,
    ObtenerConexionActualUseCase,
    ListarPaginasUseCase,
    ListarCuentasPublicitariasUseCase,
    SeleccionarPaginaUseCase,
    SeleccionarCuentaPublicitariaUseCase,
    DesconectarUseCase,
    { provide: META_CONEXIONES_REPOSITORY, useClass: PrismaMetaConexionesRepository },
    { provide: META_GRAPH_CLIENT, useClass: AxiosMetaGraphClient },
    { provide: META_OAUTH_STATE_SERVICE, useClass: JwtMetaOAuthStateService },
  ],
  exports: [META_CONEXIONES_REPOSITORY, META_GRAPH_CLIENT],
})
export class MetaConnectionsModule {}
