import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../shared/presentation/guards/org-membership.guard';
import { PermisosGuard } from '../../shared/presentation/guards/permisos.guard';
import { RequirePermission } from '../../shared/presentation/decorators/require-permission.decorator';
import { RolesEmpresaService } from '../application/roles-empresa.service';
import {
  ActualizarRolEmpresaDto,
  CrearRolEmpresaDto,
} from './dto/rol-empresa.dto';

@ApiTags('Roles de la empresa')
@ApiBearerAuth()
@RequirePermission('roles.gestionar')
@Controller('organizations/current/roles')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, PermisosGuard)
export class RolesEmpresaController {
  constructor(private readonly roles: RolesEmpresaService) {}

  @Get('catalogo')
  @RequirePermission('roles.gestionar', 'usuarios.gestionar')
  @ApiOperation({ summary: 'Catálogo de permisos de los módulos activos' })
  catalogo(@CurrentUser() ctx: RequestContext) {
    return this.roles.catalogo(ctx.organizacionId!, ctx);
  }

  @Get()
  @RequirePermission('roles.gestionar', 'usuarios.gestionar')
  @ApiOperation({ summary: 'Roles de la empresa con sus permisos y usuarios' })
  listar(@CurrentUser() ctx: RequestContext) {
    return this.roles.listar(ctx.organizacionId!, ctx);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un rol personalizado' })
  crear(@CurrentUser() ctx: RequestContext, @Body() dto: CrearRolEmpresaDto) {
    return this.roles.crear(ctx.organizacionId!, dto, ctx);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar nombre, descripción o permisos de un rol' })
  actualizar(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarRolEmpresaDto,
  ) {
    return this.roles.actualizar(ctx.organizacionId!, id, dto, ctx);
  }

  @Post(':id/restaurar')
  @ApiOperation({
    summary: 'Restaurar un rol de sistema a sus permisos por defecto',
  })
  restaurar(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.roles.restaurar(ctx.organizacionId!, id, ctx);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Desactivar un rol personalizado sin usuarios activos',
  })
  desactivar(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.roles.desactivar(ctx.organizacionId!, id, ctx);
  }
}
