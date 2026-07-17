import { Module } from '@nestjs/common';
import { DailyStatsController } from './daily-stats.controller';
import { DailyStatsService } from './daily-stats.service';

@Module({
  controllers: [DailyStatsController],
  providers: [DailyStatsService],
})
export class DailyStatsModule {}
