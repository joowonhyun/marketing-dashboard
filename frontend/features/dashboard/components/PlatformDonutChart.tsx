"use client";

import { useTheme } from "next-themes";
import { PieChart, Pie, Tooltip, ResponsiveContainer } from "recharts";
import { Platform, Campaign, DailyStat } from "@/shared/types";
import { useFilterStore } from "@/features/filter/store/useFilterStore";
import { useFilteredData } from "@/features/filter/hooks/useFilteredData";
import {
  PieLabelProps,
  PlatformMetric,
} from "@/features/dashboard/types/chart";
import { ChartLabel } from "./ChartLabel";
import { PLATFORM_NAMES } from "@/shared/constants/platforms";
import { usePlatformDonutData } from "@/features/dashboard/hooks/usePlatformDonutData";
import { CHART_CONFIG } from "@/shared/constants/chart";

interface Props {
  allCampaigns: Campaign[];
  allDailyStats: DailyStat[];
}

export default function PlatformDonutChart({
  allCampaigns,
  allDailyStats,
}: Props) {
  const { campaigns } = useFilteredData(allCampaigns, allDailyStats);
  const { metric, setMetric, chartData } = usePlatformDonutData(campaigns);
  const { platforms, setPlatforms } = useFilterStore();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const handleSliceClick = (data: { name?: string }) => {
    const platformName = data.name as Platform;
    if (!platformName || !PLATFORM_NAMES.includes(platformName)) return;

    if (platforms.includes(platformName)) {
      setPlatforms(platforms.filter((p: Platform) => p !== platformName));
    } else {
      setPlatforms([...platforms, platformName]);
    }
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ minHeight: CHART_CONFIG.PLATFORM_DONUT.MIN_HEIGHT }}
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-[15px]">플랫폼별 성과</h3>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value as PlatformMetric)}
          className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 outline-none cursor-pointer"
        >
          <option value="totalCost">비용</option>
          <option value="impressions">노출수</option>
          <option value="clicks">클릭수</option>
          <option value="conversions">전환수</option>
        </select>
      </div>

      <div className="flex-1 w-full relative group [&_path.recharts-sector]:hover:opacity-80 [&_path.recharts-sector]:transition-opacity">
        {chartData.length > 0 ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={CHART_CONFIG.PLATFORM_DONUT.INITIAL_DIMENSION}
          >
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={CHART_CONFIG.PLATFORM_DONUT.INNER_RADIUS}
                outerRadius={CHART_CONFIG.PLATFORM_DONUT.OUTER_RADIUS}
                paddingAngle={CHART_CONFIG.PLATFORM_DONUT.PADDING_ANGLE}
                dataKey="value"
                onClick={handleSliceClick}
                cursor="pointer"
                label={(props) => (
                  <ChartLabel {...(props as PieLabelProps)} />
                )}
                labelLine={false}
                isAnimationActive={false}
              />
              <Tooltip
                formatter={(
                  value:
                    | string
                    | number
                    | undefined
                    | readonly (string | number)[],
                ) => {
                  const numValue = Array.isArray(value)
                    ? Number(value[0])
                    : Number(value);
                  return new Intl.NumberFormat("ko-KR").format(numValue || 0);
                }}
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
              />
            </PieChart>
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
