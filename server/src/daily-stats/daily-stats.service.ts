import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DailyStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const stats = await this.prisma.dailyStat.findMany({
      orderBy: { id: 'asc' },
    });
    return stats.map((s) => ({
      ...s,
      date: s.date.toISOString().slice(0, 10),
    }));
  }
}
