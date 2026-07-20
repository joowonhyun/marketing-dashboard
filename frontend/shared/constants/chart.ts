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
    // ResponsiveContainer가 실제 크기를 관측하기 전(첫 렌더)에 쓰는 초기값.
    // 지정하지 않으면 -1/-1로 렌더되어 recharts가 콘솔 경고를 띄운다.
    INITIAL_DIMENSION: { width: 520, height: 250 },
  },

  // 플랫폼별 도넛 차트 (Pie Chart)
  PLATFORM_DONUT: {
    INNER_RADIUS: 45,
    OUTER_RADIUS: 70,
    PADDING_ANGLE: 2,
    MIN_HEIGHT: "250px",
    INITIAL_DIMENSION: { width: 220, height: 210 },
  },

  // 우수 캠페인 랭킹 차트 (Bar Chart)
  TOP_RANKING: {
    MARGIN: { top: 10, right: 30, left: 10, bottom: 0 },
    Y_AXIS_WIDTH: 96,
    BAR_SIZE: 24,
    BAR_RADIUS: [0, 4, 4, 0] as [number, number, number, number],
    AXIS_FONT_SIZE: 11,
    // 캠페인명 표시 최대 글자 수. Y_AXIS_WIDTH(96px)·폰트(11px) 기준
    // 두 줄로 줄바꿈되지 않고 한 줄 말줄임으로 들어가는 길이.
    NAME_MAX_LENGTH: 7,
    INITIAL_DIMENSION: { width: 220, height: 150 },
  },
} as const;
