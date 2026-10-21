import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../shared/presentation/guards/org-membership.guard';
import { RolesGuard } from '../../shared/presentation/guards/roles.guard';
import { Roles } from '../../shared/presentation/decorators/roles.decorator';
import { GestionMembresiasService } from '../application/gestion-membresias.service';
import {
  CrearUsuarioEmpresaDto,
  EditarUsuarioEmpresaDto,
  EstadoUsuarioEmpresaDto,
  PasswordTemporalDto,
  ReasignarLeadsUsuarioDto,
} from './dto/usuario-empresa.dto';

@Controller('organizations/current/users')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, RolesGuard)
@Roles('PROPIETARIO', 'ADMINISTRADOR')
export class UsuariosEmpresaController {
  constructor(private readonly gestion: GestionMembresiasService) {}
  @Get() listar(@CurrentUser() ctx: RequestContext) {
    return this.gestion.listar(ctx.organizacionId!, ctx);
  }
  @Post() crear(
    @CurrentUser() ctx: RequestContext,
    @Body() dto: CrearUsuarioEmpresaDto,
  ) {
    return this.gestion.crear(ctx.organizacionId!, dto, ctx);
  }
  @Patch(':usuarioId') editar(
    @CurrentUser() ctx: RequestContext,
    @Param('usuarioId', ParseUUIDPipe) id: string,
    @Body() dto: EditarUsuarioEmpresaDto,
  ) {
    return this.gestion.editar(ctx.organizacionId!, id, dto, ctx);
  }
  @Patch(':usuarioId/estado') estado(
    @CurrentUser() ctx: RequestContext,
    @Param('usuarioId', ParseUUIDPipe) id: string,
    @Body() dto: EstadoUsuarioEmpresaDto,
  ) {
    return this.gestion.cambiarEstado(ctx.organizacionId!, id, dto.estado, ctx);
  }
  @Post(':usuarioId/password-temporal') password(
    @CurrentUser() ctx: RequestContext,
    @Param('usuarioId', ParseUUIDPipe) id: string,
    @Body() dto: PasswordTemporalDto,
  ) {
    return this.gestion.passwordTemporal(
      ctx.organizacionId!,
      id,
      dto.password,
      ctx,
    );
  }
  @Post(':usuarioId/reasignar-leads') reasignar(
    @CurrentUser() ctx: RequestContext,
    @Param('usuarioId', ParseUUIDPipe) id: string,
    @Body() dto: ReasignarLeadsUsuarioDto,
  ) {
    return this.gestion.reasignarLeads(
      ctx.organizacionId!,
      id,
      dto.destinoUsuarioId,
      ctx,
    );
  }
}
