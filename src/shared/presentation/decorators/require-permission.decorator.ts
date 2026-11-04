import { SetMetadata } from '@nestjs/common';
import type { CodigoPermiso } from '../../domain/permisos';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';
/** Basta con tener uno de los permisos indicados. El del método reemplaza al de la clase. */
export const RequirePermission = (...permisos: CodigoPermiso[]) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permisos);
