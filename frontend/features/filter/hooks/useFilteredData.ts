import { useMemo } from "react";
import { useFilterStore } from "@/features/filter/store/useFilterStore";
import { Campaign, DailyStat, NormalizedCampaign } from "@/shared/types";
import {
  normalizePlatform,
  normalizeStatus,
  normalizeNumber,
  normalizeDate,
} from "@/shared/utils/dataset";
import { calculateCTR, calculateCPC, calculateROAS } from "@/shared/utils/calc";

/**
 * 전역 상태 관리 저장소(Zustand)의 필터 옵션 변화를 구독하고, 원본 캠페인과 원본 일별 통계 데이터를 바탕으로
 * 필터 조건(AND) 교집합을 도출해 대시보드와 테이블 전반에 실시간으로 반영하는 커스텀 훅입니다.
 *
 * 1. 선택된 기간(startDate ~ endDate)에만 한 줄이라도 걸치는 캠페인을 추려냅니다.
 * 2. 체크된 다중 매체(Platform)와 상태(Status)를 추가로 교집합 시켜 캠페인을 간추립니다.
 * 3. 살아남은 캠페인 ID에 속하면서 동시에 선택된 날짜 기간에만 존재하는 Daily Stats(일별 통계)를 필터링합니다.
 * 4. 최종적으로 간추린 통계들을 모두 더하여 정규화된 캠페인 배열(NormalizedCampaign)로 조립합니다.
 *
 * @param {Campaign[]} allCampaigns - 서버로부터 초기 패치다운된 전체 캠페인 원본 데이터 배열
 * @param {DailyStat[]} allDailyStats - 서버로부터 초기 패치다운된 전체 일별 통계 원본 데이터 배열
 * @returns {{ campaigns: NormalizedCampaign[], dailyStats: DailyStat[] }} 조건에 맞춰 필터링되고 전처리 계산이 마무리된 컴포넌트 공급용 캠페인 목록과 통계 데이터
 */
export const useFilteredData = (
  allCampaigns: Campaign[],
  allDailyStats: DailyStat[],
) => {
  const {
    startDate: rawStartDate,
    endDate: rawEndDate,
    statuses,
    platforms,
  } = useFilterStore();
  const startDate = normalizeDate(rawStartDate);
  const endDate = normalizeDate(rawEndDate);

  return useMemo(() => {
    // 1. 캠페인을 날짜 범위(Date Range) 교집합으로 필터링
    const dateFiltered = allCampaigns.filter((c) => {
      const campStart = normalizeDate(c.startDate);
      const campEnd = normalizeDate(c.endDate);
      return campStart <= endDate && campEnd >= startDate;
    });

    // 2. 캠페인을 매체(Platform) 및 상태(Status)로 추가 필터링
    const platformFiltered =
      platforms.length > 0
        ? dateFiltered.filter((c) =>
            platforms.includes(normalizePlatform(c.platform)),
          )
        : dateFiltered;

    const statusFiltered =
      statuses.length > 0
        ? platformFiltered.filter((c) =>
            statuses.includes(normalizeStatus(c.status)),
          )
        : platformFiltered;

    // 3. 일별 통계(Daily Stats)를 선택한 날짜 및 매칭된 캠페인으로 필터링
    const activeCampaignIds = new Set(statusFiltered.map((c) => c.id));

    // 시작일(startDate)과 종료일(endDate) 사이에 포함되고 활성화된 캠페인에 속하는 통계만 추출
    const filteredStats = allDailyStats.filter((stat) => {
      if (!activeCampaignIds.has(stat.campaignId)) return false;
      return stat.date >= startDate && stat.date <= endDate;
    });

    // 4. 필터링된 일별 통계를 바탕으로 정규화된 캠페인 데이터 병합/집계
    const statsMap = new Map<string, DailyStat[]>();
    filteredStats.forEach((stat) => {
      if (!statsMap.has(stat.campaignId)) {
        statsMap.set(stat.campaignId, []);
      }
      statsMap.get(stat.campaignId)!.push(stat);
    });

    const normalizedCampaigns: NormalizedCampaign[] = statusFiltered.map(
      (c) => {
        const stats = statsMap.get(c.id) || [];

        let impressions = 0;
        let clicks = 0;
        let conversions = 0;
        let cost = 0;
        let conversionsValue = 0;

        stats.forEach((s) => {
          impressions += normalizeNumber(s.impressions);
          clicks += normalizeNumber(s.clicks);
          conversions += normalizeNumber(s.conversions);
          cost += normalizeNumber(s.cost);
          conversionsValue += normalizeNumber(s.conversionsValue);
        });

        return {
          id: c.id,
          name: c.name || `캠페인 ${c.id}`,
          status: normalizeStatus(c.status),
          platform: normalizePlatform(c.platform),
          budget: normalizeNumber(c.budget),
          startDate: normalizeDate(c.startDate),
          endDate: normalizeDate(c.endDate),
          totalCost: cost,
          impressions,
          clicks,
          conversions,
          conversionsValue,
          ctr: calculateCTR(clicks, impressions),
          cpc: calculateCPC(cost, clicks),
          roas: calculateROAS(conversionsValue, cost),
        };
      },
    );

    return {
      campaigns: normalizedCampaigns,
      dailyStats: filteredStats,
    };
  }, [allCampaigns, allDailyStats, startDate, endDate, statuses, platforms]);
};
