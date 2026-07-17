/**
 * 애플리케이션에서 지원하는 광고 플랫폼의 중앙 설정 파일입니다.
 * 새로운 플랫폼을 추가하려면 이 객체에 설정을 추가하면 됩니다.
 */
export const PLATFORM_CONFIG = {
  Google: {
    label: "Google",
    color: "#ea4335",
    matchKeywords: ["google"],
  },
  Meta: {
    label: "Meta",
    color: "#1877f2",
    matchKeywords: ["facebook", "meta"],
  },
  Naver: {
    label: "Naver",
    color: "#03c75a",
    matchKeywords: ["naver", "네이버"],
  },
} as const;

export type Platform = keyof typeof PLATFORM_CONFIG;

export const PLATFORM_NAMES = Object.keys(PLATFORM_CONFIG) as Platform[];

export const PLATFORM_OPTIONS = PLATFORM_NAMES.map((name) => ({
  label: PLATFORM_CONFIG[name].label,
  value: name,
}));
