import {
  Controller,
  Delete,
  Get,
  Header,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../shared/presentation/guards/org-membership.guard';
import { RolesGuard } from '../../shared/presentation/guards/roles.guard';
import { Roles } from '../../shared/presentation/decorators/roles.decorator';
import {
  LIMITE_LOGO_BYTES,
  LogoOrganizacionService,
} from '../application/logo-organizacion.service';

@ApiTags('Organizations')
@ApiBearerAuth('JWT-auth')
@Controller('organizations/current/logo')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, RolesGuard)
export class OrganizationLogoController {
  constructor(private readonly logos: LogoOrganizacionService) {}

  @Get()
  @ApiOperation({
    summary: 'Ver el logo de la empresa activa (todos sus miembros).',
  })
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async obtener(
    @CurrentUser() ctx: RequestContext,
    @Query('v') version?: string,
  ) {
    const buffer = await this.logos.obtener(ctx.organizacionId!, version);
    return new StreamableFile(buffer, {
      type: 'image/webp',
      length: buffer.length,
      disposition: 'inline',
    });
  }

  @Post()
  @Roles('PROPIETARIO', 'ADMINISTRADOR')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo'],
      properties: { archivo: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary:
      'Subir un logo al prefijo de esta empresa en el bucket compartido.',
  })
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: LIMITE_LOGO_BYTES, files: 1 },
    }),
  )
  subir(
    @CurrentUser() ctx: RequestContext,
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    return this.logos.subir(ctx.organizacionId!, ctx.usuarioId, archivo);
  }

  @Delete()
  @Roles('PROPIETARIO', 'ADMINISTRADOR')
  @ApiOperation({
    summary: 'Quitar el logo propio para volver al logo del sistema.',
  })
  quitar(@CurrentUser() ctx: RequestContext) {
    return this.logos.quitar(ctx.organizacionId!, ctx.usuarioId);
  }
}
