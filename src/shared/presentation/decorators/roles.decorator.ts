import { SetMetadata } from '@nestjs/common';
import type { RolOrganizacion } from '../../../auth/domain/request-context.interface';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: RolOrganizacion[]) =>
  SetMetadata(ROLES_KEY, roles);
