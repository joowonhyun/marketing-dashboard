import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import {
  BulkDeleteCampaignsDto,
  BulkUpdateCampaignStatusDto,
} from './dto/bulk-campaign.dto';

const toDateOnly = (date: Date | null): string | null =>
  date ? date.toISOString().slice(0, 10) : null;

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const campaigns = await this.prisma.campaign.findMany({
      orderBy: { id: 'asc' },
    });
    return campaigns.map((c) => ({
      ...c,
      startDate: toDateOnly(c.startDate),
      endDate: toDateOnly(c.endDate),
    }));
  }

  async create(dto: CreateCampaignDto) {
    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('종료일은 시작일 이후여야 합니다.');
    }
    if (dto.plannedCost > dto.budget) {
      throw new BadRequestException('집행 금액은 예산을 초과할 수 없습니다.');
    }

    const id = `CAMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const campaign = await this.prisma.campaign.create({
      data: {
        id,
        name: dto.name,
        platform: dto.platform,
        status: dto.status,
        budget: dto.budget,
        plannedCost: dto.plannedCost,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });

    return {
      ...campaign,
      startDate: toDateOnly(campaign.startDate),
      endDate: toDateOnly(campaign.endDate),
    };
  }

  /**
   * 여러 건의 상태를 한 요청으로 변경한다.
   * 존재하지 않는 id가 섞이면 아무것도 바꾸지 않고 실패시킨다 — 일부만 반영된 채
   * "성공"으로 보고되면 화면과 DB가 어긋난다.
   */
  async updateStatuses(dto: BulkUpdateCampaignStatusDto) {
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.campaign.count({ where: { id: { in: dto.ids } } });
      if (found !== dto.ids.length) {
        throw new NotFoundException(
          `요청한 캠페인 ${dto.ids.length}건 중 ${found}건만 존재합니다. 목록을 새로고침해주세요.`,
        );
      }

      const { count } = await tx.campaign.updateMany({
        where: { id: { in: dto.ids } },
        data: { status: dto.status },
      });
      return { count };
    });
  }

  /** 여러 건을 한 요청으로 삭제한다. 부분 삭제 방지는 updateStatuses와 동일. */
  async removeMany(dto: BulkDeleteCampaignsDto) {
    await this.prisma.$transaction(async (tx) => {
      const found = await tx.campaign.count({ where: { id: { in: dto.ids } } });
      if (found !== dto.ids.length) {
        throw new NotFoundException(
          `요청한 캠페인 ${dto.ids.length}건 중 ${found}건만 존재합니다. 목록을 새로고침해주세요.`,
        );
      }

      await tx.campaign.deleteMany({ where: { id: { in: dto.ids } } });
    });
  }
}
