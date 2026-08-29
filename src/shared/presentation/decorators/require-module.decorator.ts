import { SetMetadata } from '@nestjs/common';

export const REQUIRE_MODULE_KEY = 'requireModule';
export const RequireModule = (codigo: string) =>
  SetMetadata(REQUIRE_MODULE_KEY, codigo);
