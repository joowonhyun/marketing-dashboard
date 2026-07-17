import { RankingMetric } from "@/features/dashboard/types/chart";

/**
 * 대시보드 지표(Metric)별 고유 브랜드 색상을 반환합니다.
 * @param {RankingMetric} metric - 'roas' | 'ctr' | 'cpc'
 * @returns {string} HEX 색상 코드
 */
export const getMetricColor = (metric: RankingMetric): string => {
  switch (metric) {
    case "roas":
      return "#f59e0b"; // Orange
    case "ctr":
      return "#06b6d4"; // Cyan
    case "cpc":
      return "#8b5cf6"; // Purple
    default:
      return "#f59e0b";
  }
};
