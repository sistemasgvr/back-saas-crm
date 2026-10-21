import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../shared/presentation/guards/platform-admin.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';

class GrupoFieldsDto {
  @IsString() @MaxLength(120) nombre: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsString() @MaxLength(80) icono?: string;
  @IsOptional() @IsInt() @Min(0) @Max(999) orden?: number;
}
class CreateGrupoDto extends GrupoFieldsDto {
  @IsString() @MaxLength(50) @Matches(/^[A-Z0-9_]+$/) codigo: string;
}
class UpdateGrupoDto extends PartialType(GrupoFieldsDto) {}

@ApiTags('Platform Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin/module-groups')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminModuleGroupsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() listar() {
    return this.prisma.moduloGrupo.findMany({
      orderBy: [{ orden: 'asc' }, { codigo: 'asc' }],
    });
  }
  @Post() async crear(
    @Body() dto: CreateGrupoDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    try {
      return await this.prisma.moduloGrupo.create({
        data: { ...dto, usuarioCreacion: ctx.usuarioId },
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002')
        throw new ConflictException('El código de grupo ya existe');
      throw e;
    }
  }
  @Patch(':id') async editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGrupoDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    await this.existe(id);
    return this.prisma.moduloGrupo.update({
      where: { id },
      data: { ...dto, usuarioEdicion: ctx.usuarioId },
    });
  }
  @Patch(':id/estado') async estado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    await this.existe(id);
    return this.prisma.moduloGrupo.update({
      where: { id },
      data: { estado: dto.estado, usuarioEdicion: ctx.usuarioId },
    });
  }
  private async existe(id: string) {
    if (!(await this.prisma.moduloGrupo.findUnique({ where: { id } })))
      throw new NotFoundException('Grupo no encontrado');
  }
}
