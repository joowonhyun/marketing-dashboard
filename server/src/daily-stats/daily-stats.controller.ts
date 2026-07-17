import { Controller, Get } from '@nestjs/common';
import { DailyStatsService } from './daily-stats.service';

@Controller('daily-stats')
export class DailyStatsController {
  constructor(private readonly dailyStatsService: DailyStatsService) {}

  @Get()
  findAll() {
    return this.dailyStatsService.findAll();
  }
}
