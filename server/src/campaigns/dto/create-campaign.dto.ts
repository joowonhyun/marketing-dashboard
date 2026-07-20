import { IsIn, IsInt, IsDateString, Length, Max, Min } from 'class-validator';
import { CAMPAIGN_LIMITS } from '../campaign.constants';

const PLATFORMS = ['Google', 'Naver', 'Meta'] as const;
const STATUSES = ['active', 'paused', 'ended'] as const;

export class CreateCampaignDto {
  @Length(CAMPAIGN_LIMITS.NAME_MIN_LENGTH, CAMPAIGN_LIMITS.NAME_MAX_LENGTH, {
    message: `캠페인명은 ${CAMPAIGN_LIMITS.NAME_MIN_LENGTH}자 이상 ${CAMPAIGN_LIMITS.NAME_MAX_LENGTH}자 이하로 입력해주세요.`,
  })
  name: string;

  @IsIn(PLATFORMS, {
    message: `매체는 ${PLATFORMS.join(', ')} 중 하나여야 합니다.`,
  })
  platform: (typeof PLATFORMS)[number];

  @IsIn(STATUSES, {
    message: `상태값은 ${STATUSES.join(', ')} 중 하나여야 합니다.`,
  })
  status: (typeof STATUSES)[number];

  @IsInt({ message: '예산은 정수여야 합니다.' })
  @Min(CAMPAIGN_LIMITS.BUDGET_MIN, {
    message: `예산은 ${CAMPAIGN_LIMITS.BUDGET_MIN.toLocaleString()}원 이상이어야 합니다.`,
  })
  @Max(CAMPAIGN_LIMITS.BUDGET_MAX, {
    message: `예산은 ${CAMPAIGN_LIMITS.BUDGET_MAX.toLocaleString()}원 이하여야 합니다.`,
  })
  budget: number;

  @IsDateString({}, { message: '시작일은 올바른 날짜 형식이어야 합니다.' })
  startDate: string;

  @IsDateString({}, { message: '종료일은 올바른 날짜 형식이어야 합니다.' })
  endDate: string;
}
