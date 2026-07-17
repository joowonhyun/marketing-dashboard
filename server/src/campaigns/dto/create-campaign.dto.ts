import { IsIn, IsInt, IsDateString, Length, Max, Min } from 'class-validator';
import { CAMPAIGN_LIMITS } from '../campaign.constants';

const PLATFORMS = ['Google', 'Naver', 'Meta'] as const;
const STATUSES = ['active', 'paused', 'ended'] as const;

export class CreateCampaignDto {
  @Length(CAMPAIGN_LIMITS.NAME_MIN_LENGTH, CAMPAIGN_LIMITS.NAME_MAX_LENGTH)
  name: string;

  @IsIn(PLATFORMS)
  platform: (typeof PLATFORMS)[number];

  @IsIn(STATUSES)
  status: (typeof STATUSES)[number];

  @IsInt()
  @Min(CAMPAIGN_LIMITS.BUDGET_MIN)
  @Max(CAMPAIGN_LIMITS.BUDGET_MAX)
  budget: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
