import { IsIn } from 'class-validator';

const STATUSES = ['active', 'paused', 'ended'] as const;

export class UpdateCampaignStatusDto {
  @IsIn(STATUSES, {
    message: '상태값은 active, paused, ended 중 하나여야 합니다.',
  })
  status: (typeof STATUSES)[number];
}
