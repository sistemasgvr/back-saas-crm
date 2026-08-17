import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** Smoke test deploy — GET /api/health */
  @Get('health')
  health() {
    return {
      status: 'ok',
      port: this.config.get<number>('PORT') ?? null,
      nodeEnv: this.config.get<string>('NODE_ENV') ?? 'production',
    };
  }
}
