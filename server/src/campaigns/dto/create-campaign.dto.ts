import { IsIn, IsInt, IsDateString, Length, Max, Min } from 'class-validator';
import { CAMPAIGN_LIMITS, PLATFORMS, STATUSES } from '../campaign.constants';
import type { Platform, Status } from '../campaign.constants';

export class CreateCampaignDto {
  @Length(CAMPAIGN_LIMITS.NAME_MIN_LENGTH, CAMPAIGN_LIMITS.NAME_MAX_LENGTH, {
    message: `캠페인명은 ${CAMPAIGN_LIMITS.NAME_MIN_LENGTH}자 이상 ${CAMPAIGN_LIMITS.NAME_MAX_LENGTH}자 이하로 입력해주세요.`,
  })
  name: string;

  @IsIn(PLATFORMS, {
    message: `매체는 ${PLATFORMS.join(', ')} 중 하나여야 합니다.`,
  })
  platform: Platform;

  @IsIn(STATUSES, {
    message: `상태값은 ${STATUSES.join(', ')} 중 하나여야 합니다.`,
  })
  status: Status;

  @IsInt({ message: '예산은 정수여야 합니다.' })
  @Min(CAMPAIGN_LIMITS.BUDGET_MIN, {
    message: `예산은 ${CAMPAIGN_LIMITS.BUDGET_MIN.toLocaleString()}원 이상이어야 합니다.`,
  })
  @Max(CAMPAIGN_LIMITS.BUDGET_MAX, {
    message: `예산은 ${CAMPAIGN_LIMITS.BUDGET_MAX.toLocaleString()}원 이하여야 합니다.`,
  })
  budget: number;

  @IsInt({ message: '집행 금액은 정수여야 합니다.' })
  @Min(CAMPAIGN_LIMITS.COST_MIN, {
    message: `집행 금액은 ${CAMPAIGN_LIMITS.COST_MIN.toLocaleString()}원 이상이어야 합니다.`,
  })
  @Max(CAMPAIGN_LIMITS.COST_MAX, {
    message: `집행 금액은 ${CAMPAIGN_LIMITS.COST_MAX.toLocaleString()}원 이하여야 합니다.`,
  })
  plannedCost: number;

  @IsDateString({}, { message: '시작일은 올바른 날짜 형식이어야 합니다.' })
  startDate: string;

  @IsDateString({}, { message: '종료일은 올바른 날짜 형식이어야 합니다.' })
  endDate: string;
}
