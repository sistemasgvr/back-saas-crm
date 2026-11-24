import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HttpAuditService } from './http-audit.service';
import { HttpAuditMiddleware } from './http-audit.middleware';
import { HttpAuditFilter } from './http-audit.filter';

@Module({
  providers: [
    HttpAuditService,
    HttpAuditMiddleware,
    { provide: APP_FILTER, useClass: HttpAuditFilter },
  ],
})
export class HttpAuditModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpAuditMiddleware).forRoutes('{*path}');
  }
}
