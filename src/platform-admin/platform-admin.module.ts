import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ModulesModule } from '../modules/modules.module';
import { AdminOrganizationsController } from './presentation/admin-organizations.controller';
import { AdminUsersController } from './presentation/admin-users.controller';
import { AdminModulesController } from './presentation/admin-modules.controller';
import { AdminOrganizationModulesController } from './presentation/admin-organization-modules.controller';
import { CrearOrganizacionUseCase } from './application/use-cases/crear-organizacion.use-case';
import { ListarOrganizacionesUseCase } from './application/use-cases/listar-organizaciones.use-case';
import { ObtenerOrganizacionUseCase } from './application/use-cases/obtener-organizacion.use-case';
import { ActualizarOrganizacionAdminUseCase } from './application/use-cases/actualizar-organizacion-admin.use-case';
import { DesactivarOrganizacionUseCase } from './application/use-cases/desactivar-organizacion.use-case';
import { CrearUsuarioUseCase } from './application/use-cases/crear-usuario.use-case';
import { ListarUsuariosUseCase } from './application/use-cases/listar-usuarios.use-case';
import { ObtenerUsuarioUseCase } from './application/use-cases/obtener-usuario.use-case';
import { CambiarEstadoUsuarioUseCase } from './application/use-cases/cambiar-estado-usuario.use-case';
import { AsignarUsuarioAOrganizacionUseCase } from './application/use-cases/asignar-usuario-a-organizacion.use-case';
import { ListarMatrizModulosOrganizacionUseCase } from './application/use-cases/listar-matriz-modulos-organizacion.use-case';
import { ToggleModuloOrganizacionUseCase } from './application/use-cases/toggle-modulo-organizacion.use-case';
import { ORGANIZACIONES_ADMIN_REPOSITORY } from './application/ports/organizaciones-admin.repository.port';
import { PrismaOrganizacionesAdminRepository } from './infrastructure/prisma-organizaciones-admin.repository';
import { USUARIOS_ADMIN_REPOSITORY } from './application/ports/usuarios-admin.repository.port';
import { PrismaUsuariosAdminRepository } from './infrastructure/prisma-usuarios-admin.repository';
import { ORGANIZACION_MODULOS_ADMIN_REPOSITORY } from './application/ports/organizacion-modulos-admin.repository.port';
import { PrismaOrganizacionModulosAdminRepository } from './infrastructure/prisma-organizacion-modulos-admin.repository';

@Module({
  imports: [AuthModule, ModulesModule],
  controllers: [
    AdminOrganizationsController,
    AdminUsersController,
    AdminModulesController,
    AdminOrganizationModulesController,
  ],
  providers: [
    CrearOrganizacionUseCase,
    ListarOrganizacionesUseCase,
    ObtenerOrganizacionUseCase,
    ActualizarOrganizacionAdminUseCase,
    DesactivarOrganizacionUseCase,
    CrearUsuarioUseCase,
    ListarUsuariosUseCase,
    ObtenerUsuarioUseCase,
    CambiarEstadoUsuarioUseCase,
    AsignarUsuarioAOrganizacionUseCase,
    ListarMatrizModulosOrganizacionUseCase,
    ToggleModuloOrganizacionUseCase,
    { provide: ORGANIZACIONES_ADMIN_REPOSITORY, useClass: PrismaOrganizacionesAdminRepository },
    { provide: USUARIOS_ADMIN_REPOSITORY, useClass: PrismaUsuariosAdminRepository },
    {
      provide: ORGANIZACION_MODULOS_ADMIN_REPOSITORY,
      useClass: PrismaOrganizacionModulosAdminRepository,
    },
  ],
})
export class PlatformAdminModule {}
