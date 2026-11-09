import { PLATFORM_CONFIG, PLATFORM_NAMES } from "@/shared/constants/platforms";
import {
  Platform,
  CampaignStatus,
  DailyStat,
  NormalizedCampaign,
} from "@/shared/types";

export const normalizePlatform = (platform: string): Platform => {
  const lower = platform.toLowerCase();

  // 설정에서 일치하는 플랫폼 찾기
  const matched = PLATFORM_NAMES.find((key) =>
    PLATFORM_CONFIG[key].matchKeywords.some((keyword) =>
      lower.includes(keyword),
    ),
  );

  return matched || PLATFORM_NAMES[0]; // 기본값 (첫 번째 플랫폼)
};

export const normalizeStatus = (status: string): CampaignStatus => {
  const lower = status.toLowerCase();
  if (lower === "running") return "active";
  if (lower === "stopped") return "ended";
  if (["active", "paused", "ended"].includes(lower))
    return lower as CampaignStatus;
  return "active"; // 기본값 (Fallback)
};

export const normalizeNumber = (
  val: string | number | null | undefined,
): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  const parsed = parseInt(val.replace(/[^0-9-]/g, ""), 10);
  return isNaN(parsed) ? 0 : parsed;
};

// 날짜가 없으면 null을 그대로 둔다. 가짜 날짜로 채우면 종료일 없는(진행 중) 캠페인이
// 과거에 끝난 캠페인이 되어 기간 필터에서 사라진다.
export const normalizeDate = (
  dateStr: string | null | undefined,
): string | null => {
  if (!dateStr) return null;
  // 슬래시나 점 형식의 문자열을 대시(-)로 통일하고 공백 제거 (예: 2026. 04. 12 -> 2026-04-12)
  let cleaned = dateStr.replace(/[\/\.]/g, "-").replace(/\s/g, "");
  if (cleaned.endsWith("-")) cleaned = cleaned.slice(0, -1);
  return cleaned;
};

/**
 * 캠페인 집행 기간이 [from, to]와 겹치는지 판정합니다.
 * 종료일 null = 진행 중(끝이 열림), 시작일 null = 시작을 알 수 없음(앞이 열림).
 */
export const overlapsPeriod = (
  campStart: string | null,
  campEnd: string | null,
  from: string,
  to: string,
): boolean =>
  (campStart === null || campStart <= to) &&
  (campEnd === null || campEnd >= from);

/**
 * 현재 달의 1일과 말일을 YYYY-MM-DD 형식의 객체로 반환합니다.
 */
export const getInitialDates = () => {
  const now = new Date();
  const year = now.getFullYear();

  // 현재 과제의 모의 데이터는 2026년 기준입니다.
  // 요구사항의 "당월 1일~말일" 구연을 위해 실제 시스템 시간을 사용합니다.
  const firstDay = new Date(year, now.getMonth(), 1);
  const lastDay = new Date(year, now.getMonth() + 1, 0);

  const formatDate = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  return {
    startDate: formatDate(firstDay),
    endDate: formatDate(lastDay),
  };
};

export interface DailyChartPoint {
  date: string;
  impressions: number;
  clicks: number;
}

/**
 * DailyStat 배열을 날짜별로 집계하고 날짜 오름차순으로 정렬합니다.
 */
export const aggregateDailyStats = (
  dailyStats: DailyStat[],
): DailyChartPoint[] => {
  const grouped = new Map<string, DailyChartPoint>();

  dailyStats.forEach((stat) => {
    if (!grouped.has(stat.date)) {
      grouped.set(stat.date, { date: stat.date, impressions: 0, clicks: 0 });
    }
    const entry = grouped.get(stat.date)!;
    entry.impressions += Number(stat.impressions) || 0;
    entry.clicks += Number(stat.clicks) || 0;
  });

  return Array.from(grouped.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
};

/**
 * 캠페인 목록을 플랫폼별로 그룹화하여 특정 지표의 합계를 계산합니다.
 */
export const getPlatformTotals = (
  campaigns: NormalizedCampaign[],
  metric: keyof NormalizedCampaign,
): Map<Platform, number> => {
  const grouped = new Map<Platform, number>();

  // 모든 플랫폼 초기화
  PLATFORM_NAMES.forEach((name) => {
    grouped.set(name, 0);
  });

  campaigns.forEach((c) => {
    const val = Number(c[metric]) || 0;
    grouped.set(c.platform, (grouped.get(c.platform) || 0) + val);
  });

  return grouped;
};
