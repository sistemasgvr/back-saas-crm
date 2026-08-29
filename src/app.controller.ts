import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Saludo de humo',
    description:
      'Endpoint raíz mínimo, solo para confirmar que la API responde.',
  })
  @ApiResponse({ status: 200, description: 'Mensaje de saludo.' })
  getHello(): string {
    return this.appService.getHello();
  }

  /** Smoke test deploy — GET /api/health */
  @Get('health')
  @ApiOperation({
    summary: 'Health check',
    description:
      'Usado por el pipeline de deploy para confirmar que el proceso arrancó correctamente.',
  })
  @ApiResponse({ status: 200, description: 'Estado del proceso.' })
  health() {
    return {
      status: 'ok',
      port: this.config.get<number>('PORT') ?? null,
      nodeEnv: this.config.get<string>('NODE_ENV') ?? 'production',
    };
  }
}
