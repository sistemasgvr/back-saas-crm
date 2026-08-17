import { Module } from '@nestjs/common';
import { DashboardController } from './presentation/dashboard.controller';

@Module({
  controllers: [DashboardController],
})
export class DashboardModule {}
