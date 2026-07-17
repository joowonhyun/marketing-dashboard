import { useState } from "react";

export type ChartMetric = "impressions" | "clicks";

interface MetricToggleState {
  showImpressions: boolean;
  showClicks: boolean;
  toggleMetric: (metric: ChartMetric) => void;
}

/**
 * 일별 추이 차트의 메트릭(노출수/클릭수) 토글 상태를 관리합니다.
 * 최소 1개의 메트릭은 항상 활성화 상태를 유지합니다.
 */
export function useMetricToggle(): MetricToggleState {
  const [showImpressions, setShowImpressions] = useState(true);
  const [showClicks, setShowClicks] = useState(true);

  const toggleMetric = (metric: ChartMetric) => {
    if (metric === "impressions") {
      // 노출수만 켜져 있을 때는 끄지 않음
      if (showImpressions && !showClicks) return;
      setShowImpressions((prev) => !prev);
    } else {
      // 클릭수만 켜져 있을 때는 끄지 않음
      if (!showImpressions && showClicks) return;
      setShowClicks((prev) => !prev);
    }
  };

  return { showImpressions, showClicks, toggleMetric };
}
