// shared/constants/campaign.ts의 CAMPAIGN_LIMITS와 동일한 값 (프론트와 서버 이중 검증).
export const CAMPAIGN_LIMITS = {
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
  BUDGET_MIN: 100,
  BUDGET_MAX: 1000000000,
  COST_MIN: 0,
  COST_MAX: 1000000000,
} as const;

// DTO마다 복사하지 않도록 여기 한 곳에만 정의한다.
export const PLATFORMS = ['Google', 'Naver', 'Meta'] as const;
export const STATUSES = ['active', 'paused', 'ended'] as const;

export type Platform = (typeof PLATFORMS)[number];
export type Status = (typeof STATUSES)[number];
