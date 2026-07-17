// shared/constants/campaign.ts의 CAMPAIGN_LIMITS와 동일한 값 (프론트와 서버 이중 검증).
export const CAMPAIGN_LIMITS = {
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
  BUDGET_MIN: 100,
  BUDGET_MAX: 1000000000,
} as const;
