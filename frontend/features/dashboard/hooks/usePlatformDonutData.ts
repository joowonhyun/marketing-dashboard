import { useMemo, useState } from "react";
import { NormalizedCampaign } from "@/shared/types";
import { getPlatformTotals } from "@/shared/utils/dataset";
import {
  ChartDataEntry,
  PlatformMetric,
} from "@/features/dashboard/types/chart";
import { PLATFORM_CONFIG } from "@/shared/constants/platforms";

/**
 * 캠페인 데이터를 플랫폼별(Donut Chart)로 집계하고
 * Recharts에서 즉시 사용 가능한 데이터 구조로 변환하는 커스텀 훅입니다.
 *
 * @param {NormalizedCampaign[]} campaigns - 필터링된 전체 캠페인 목록
 * @returns {Object} 지표 상태와 변환된 차트 데이터
 */
export const usePlatformDonutData = (campaigns: NormalizedCampaign[]) => {
  const [metric, setMetric] = useState<PlatformMetric>("totalCost");

  const chartData = useMemo((): ChartDataEntry[] => {
    // 1. 유틸리티를 사용하여 플랫폼별 원시 합계 계산
    const grouped = getPlatformTotals(campaigns, metric);

    // 2. 백분율 계산을 위한 전체 합계
    let totalVal = 0;
    grouped.forEach((val) => {
      totalVal += val;
    });

    // 3. Recharts 포맷으로 매핑 및 0원인 항목 필터링
    return Array.from(grouped.entries())
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({
        name,
        value,
        fill: PLATFORM_CONFIG[name].color,
        percentage:
          totalVal > 0 ? ((value / totalVal) * 100).toFixed(1) : "0.0",
      }));
  }, [campaigns, metric]);

  return {
    metric,
    setMetric,
    chartData,
  };
};
