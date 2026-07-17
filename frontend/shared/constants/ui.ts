/**
 * 공통 UI 요소의 치수 및 레이아웃 설정을 관리합니다.
 */
export const UI_DIMENSIONS = {
  // 툴바 및 서치바
  TOOLBAR: {
    SEARCH_INPUT_WIDTH: "w-64",
    DIVIDER_HEIGHT: "h-6",
  },

  // 필터 영역
  FILTER: {
    DIVIDER_HEIGHT: "h-10",
  },

  // 테마 토글 버튼
  THEME_TOGGLE: {
    SIZE: "w-10 h-10",
  },

  // 캠페인 테이블
  CAMPAIGN_TABLE: {
    COLUMN_COUNT: 9,
  },
} as const;
