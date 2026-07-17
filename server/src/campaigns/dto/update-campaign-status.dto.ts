import { IsIn } from 'class-validator';

const STATUSES = ['active', 'paused', 'ended'] as const;

export class UpdateCampaignStatusDto {
  @IsIn(STATUSES)
  status: (typeof STATUSES)[number];
}
