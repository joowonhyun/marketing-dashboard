import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { applySeedDataset, loadSeedDataset } from '../prisma/seed-utils';

@Injectable()
export class ResetService {
  private readonly logger = new Logger(ResetService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 데모 계정 하나를 공유하는 구조라 방문자가 등록/삭제/변경한 데이터가
  // 계속 쌓이는 걸 막기 위해 매일 00:00(KST)에 db.json 원본 상태로 되돌린다.
  @Cron('0 0 * * *', { timeZone: 'Asia/Seoul' })
  async handleDailyReset() {
    const result = await this.reset();
    this.logger.log(
      `자동 리셋 완료: campaigns=${result.campaignCount}, dailyStats=${result.dailyStatCount}`,
    );
  }

  reset() {
    const raw = loadSeedDataset();
    return applySeedDataset(this.prisma, raw);
  }
}
