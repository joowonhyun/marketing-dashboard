import { useMemo, useState } from "react";
import { NormalizedCampaign } from "@/shared/types";
import { RankingMetric } from "@/features/dashboard/types/chart";

/**
 * 캠페인 목록에서 특정 지표(Metric) 기준 상위 3개를 추출하여
 * 차트 렌더링용 데이터 스트럭처로 변환하는 커스텀 훅입니다.
 *
 * @param {NormalizedCampaign[]} campaigns - 필터링된 전체 캠페인 목록
 * @returns {Object} 랭킹 지표 상태와 차트 데이터
 */
export const useTopRanking = (campaigns: NormalizedCampaign[]) => {
  const [metric, setMetric] = useState<RankingMetric>("roas");

  const chartData = useMemo(() => {
    // 원본 데이터 보존을 위해 복사
    let sortedList = [...campaigns];

    // 지표별 상이한 정렬 로직 적용
    // CPC: 값이 클수록 하위이므로 오름차순 (단, 0초과만 포함)
    // 그 외(ROAS, CTR): 값이 클수록 상위이므로 내림차순
    if (metric === "cpc") {
      const validCpc = sortedList.filter((c) => c.cpc > 0);
      validCpc.sort((a, b) => a.cpc - b.cpc);
      sortedList = validCpc;
    } else {
      sortedList.sort((a, b) => (b[metric] || 0) - (a[metric] || 0));
    }

    // 상위 3개만 추출하여 차트 라이브러리(Recharts) 규격으로 매핑
    return sortedList.slice(0, 3).map((c) => ({
      name: c.name.length > 10 ? c.name.substring(0, 10) + "..." : c.name,
      fullName: c.name,
      value: Number((c[metric] || 0).toFixed(2)),
      platform: c.platform,
    }));
  }, [campaigns, metric]);

  return {
    metric,
    setMetric,
    chartData,
  };
};
