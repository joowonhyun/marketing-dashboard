import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignStatusDto } from './dto/update-campaign-status.dto';

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

    const id = `CAMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const campaign = await this.prisma.campaign.create({
      data: {
        id,
        name: dto.name,
        platform: dto.platform,
        status: dto.status,
        budget: dto.budget,
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

  async updateStatus(id: string, dto: UpdateCampaignStatusDto) {
    const campaign = await this.prisma.campaign.update({
      where: { id },
      data: { status: dto.status },
    });

    return {
      ...campaign,
      startDate: toDateOnly(campaign.startDate),
      endDate: toDateOnly(campaign.endDate),
    };
  }

  async remove(id: string) {
    await this.prisma.campaign.delete({ where: { id } });
  }
}
