"use client";

import { useTheme } from "next-themes";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Campaign, DailyStat } from "@/shared/types";
import { useFilteredData } from "@/features/filter/hooks/useFilteredData";
import { formatTick, getMetricFormat } from "@/shared/utils/formatters";
import { useTopRanking } from "@/features/dashboard/hooks/useTopRanking";
import { RankingMetric } from "@/features/dashboard/types/chart";
import { getMetricColor } from "@/features/dashboard/utils/chart";
import { CHART_CONFIG } from "@/shared/constants/chart";

interface Props {
  allCampaigns: Campaign[];
  allDailyStats: DailyStat[];
}

export default function Top3RankingChart({
  allCampaigns,
  allDailyStats,
}: Props) {
  const { campaigns } = useFilteredData(allCampaigns, allDailyStats);
  const { metric, setMetric, chartData } = useTopRanking(campaigns);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const barColor = getMetricColor(metric);

  return (
    <div className="flex flex-col h-full min-h-[250px]">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-[15px]">우수 캠페인 Top3</h3>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value as RankingMetric)}
          className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 outline-none cursor-pointer"
        >
          <option value="roas">ROAS</option>
          <option value="ctr">CTR</option>
          <option value="cpc">CPC</option>
        </select>
      </div>

      <div className="flex-1 w-full">
        {chartData.length > 0 ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={CHART_CONFIG.TOP_RANKING.INITIAL_DIMENSION}
          >
            <BarChart
              data={chartData}
              layout="vertical"
              margin={CHART_CONFIG.TOP_RANKING.MARGIN}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke={CHART_CONFIG.COMMON.GRID_COLOR}
              />
              <XAxis
                type="number"
                tick={{
                  fontSize: CHART_CONFIG.TOP_RANKING.AXIS_FONT_SIZE,
                  fill: CHART_CONFIG.COMMON.AXIS_COLOR,
                }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatTick}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{
                  fontSize: CHART_CONFIG.TOP_RANKING.AXIS_FONT_SIZE,
                  fill: CHART_CONFIG.COMMON.AXIS_COLOR,
                }}
                width={CHART_CONFIG.TOP_RANKING.Y_AXIS_WIDTH}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "transparent" }}
                contentStyle={{
                  backgroundColor: isDark
                    ? CHART_CONFIG.COMMON.TOOLTIP_BG_DARK
                    : CHART_CONFIG.COMMON.TOOLTIP_BG,
                  color: isDark
                    ? CHART_CONFIG.COMMON.TOOLTIP_TEXT_DARK
                    : CHART_CONFIG.COMMON.TOOLTIP_TEXT,
                  borderRadius: CHART_CONFIG.COMMON.TOOLTIP_BORDER_RADIUS,
                  border: `1px solid ${CHART_CONFIG.COMMON.GRID_COLOR}`,
                  fontSize: CHART_CONFIG.COMMON.TOOLTIP_FONT_SIZE,
                }}
                formatter={(value: unknown) =>
                  getMetricFormat(metric, Number(value))
                }
                labelFormatter={(label, payload) =>
                  payload?.[0]?.payload?.fullName || label
                }
              />
              {/* 모든 막대 색상이 같다면 Cell 없이 fill 속성만 사용합니다. */}
              <Bar
                dataKey="value"
                fill={barColor}
                radius={CHART_CONFIG.TOP_RANKING.BAR_RADIUS}
                barSize={CHART_CONFIG.TOP_RANKING.BAR_SIZE}
              />
            </BarChart>
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
