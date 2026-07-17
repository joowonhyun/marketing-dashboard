/**
 * Recharts 시각화 차트의 공통 및 개별 스타일 설정을 관리합니다.
 */
export const CHART_CONFIG = {
  // 공통 폰트 및 툴팁 스타일
  COMMON: {
    AXIS_FONT_SIZE: 12,
    AXIS_COLOR: "#64748b",
    GRID_COLOR: "#e2e8f0",
    TOOLTIP_BG: "#ffffff",
    TOOLTIP_BG_DARK: "#1e293b", // slate-800
    TOOLTIP_TEXT: "#0f172a", // slate-900
    TOOLTIP_TEXT_DARK: "#f1f5f9", // slate-100
    TOOLTIP_BORDER_RADIUS: "8px",
    TOOLTIP_FONT_SIZE: "12px",
  },

  // 일별 추이 차트 (Line Chart)
  DAILY_TREND: {
    MARGIN: { top: 10, right: 10, left: 0, bottom: 0 },
    STROKE_WIDTH: 2,
    DOT_RADIUS: 3,
    ACTIVE_DOT_RADIUS: 5,
  },

  // 플랫폼별 도넛 차트 (Pie Chart)
  PLATFORM_DONUT: {
    INNER_RADIUS: 45,
    OUTER_RADIUS: 70,
    PADDING_ANGLE: 2,
    MIN_HEIGHT: "250px",
  },

  // 우수 캠페인 랭킹 차트 (Bar Chart)
  TOP_RANKING: {
    MARGIN: { top: 10, right: 30, left: 10, bottom: 0 },
    Y_AXIS_WIDTH: 70,
    BAR_SIZE: 24,
    BAR_RADIUS: [0, 4, 4, 0] as [number, number, number, number],
    AXIS_FONT_SIZE: 11,
  },
} as const;
