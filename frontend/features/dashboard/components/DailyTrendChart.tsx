"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Campaign, DailyStat } from "@/shared/types";
import { useFilteredData } from "@/features/filter/hooks/useFilteredData";
import { useMetricToggle } from "@/features/dashboard/hooks/useMetricToggle";
import { aggregateDailyStats } from "@/shared/utils/dataset";
import { CHART_CONFIG } from "@/shared/constants/chart";

interface Props {
  allCampaigns: Campaign[];
  allDailyStats: DailyStat[];
}

export default function DailyTrendChart({
  allCampaigns,
  allDailyStats,
}: Props) {
  const { dailyStats } = useFilteredData(allCampaigns, allDailyStats);
  const { showImpressions, showClicks, toggleMetric } = useMetricToggle();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const chartData = useMemo(
    () => aggregateDailyStats(dailyStats),
    [dailyStats],
  );

  return (
    <div className="flex flex-col h-full min-h-[300px]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">일별 추이 차트</h3>
        <div className="flex gap-2">
          <button
            onClick={() => toggleMetric("impressions")}
            className={`px-3 py-1 text-xs rounded-full border transition-colors cursor-pointer ${showImpressions ? "bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-400" : "bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700"}`}
          >
            노출수
          </button>
          <button
            onClick={() => toggleMetric("clicks")}
            className={`px-3 py-1 text-xs rounded-full border transition-colors cursor-pointer ${showClicks ? "bg-teal-100 border-teal-200 text-teal-700 dark:bg-teal-900/30 dark:border-teal-800/50 dark:text-teal-400" : "bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700"}`}
          >
            클릭수
          </button>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[250px]">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={CHART_CONFIG.DAILY_TREND.MARGIN}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={CHART_CONFIG.COMMON.GRID_COLOR}
              />
              <XAxis
                dataKey="date"
                tick={{
                  fontSize: CHART_CONFIG.COMMON.AXIS_FONT_SIZE,
                  fill: CHART_CONFIG.COMMON.AXIS_COLOR,
                }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => {
                  const parts = val.split("-");
                  if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
                  return val;
                }}
              />
              <YAxis
                tick={{
                  fontSize: CHART_CONFIG.COMMON.AXIS_FONT_SIZE,
                  fill: CHART_CONFIG.COMMON.AXIS_COLOR,
                }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) =>
                  new Intl.NumberFormat("ko-KR", {
                    notation: "compact",
                  }).format(val)
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark
                    ? CHART_CONFIG.COMMON.TOOLTIP_BG_DARK
                    : CHART_CONFIG.COMMON.TOOLTIP_BG,
                  color: isDark
                    ? CHART_CONFIG.COMMON.TOOLTIP_TEXT_DARK
                    : CHART_CONFIG.COMMON.TOOLTIP_TEXT,
                  borderRadius: CHART_CONFIG.COMMON.TOOLTIP_BORDER_RADIUS,
                  border: "none",
                  fontSize: CHART_CONFIG.COMMON.TOOLTIP_FONT_SIZE,
                }}
                cursor={{
                  stroke: "#cbd5e1",
                  strokeWidth: 1,
                  strokeDasharray: "3 3",
                }}
                labelFormatter={(label) => `날짜: ${label}`}
                formatter={(value: unknown) => [
                  new Intl.NumberFormat("ko-KR").format(Number(value) || 0),
                ]}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              {showImpressions && (
                <Line
                  type="monotone"
                  dataKey="impressions"
                  name="노출수"
                  stroke="#3b82f6"
                  strokeWidth={CHART_CONFIG.DAILY_TREND.STROKE_WIDTH}
                  dot={{
                    r: CHART_CONFIG.DAILY_TREND.DOT_RADIUS,
                    fill: "#3b82f6",
                  }}
                  activeDot={{ r: CHART_CONFIG.DAILY_TREND.ACTIVE_DOT_RADIUS }}
                />
              )}
              {showClicks && (
                <Line
                  type="monotone"
                  dataKey="clicks"
                  name="클릭수"
                  stroke="#14b8a6"
                  strokeWidth={CHART_CONFIG.DAILY_TREND.STROKE_WIDTH}
                  dot={{
                    r: CHART_CONFIG.DAILY_TREND.DOT_RADIUS,
                    fill: "#14b8a6",
                  }}
                  activeDot={{ r: CHART_CONFIG.DAILY_TREND.ACTIVE_DOT_RADIUS }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-slate-400">
            데이터가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
