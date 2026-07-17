/**
 * 숫자 데이터를 단위(통화, 비율)에 맞게 포맷팅합니다.
 * @param val 변환할 숫자
 * @param isCurrency 통화(원) 여부
 * @param isPercent 비율(%) 여부
 */
const FORMAT_CONFIG = {
  MAX_FRACTION_DIGITS: 2,
} as const;

export const formatNumber = (
  val: number,
  isCurrency: boolean = false,
  isPercent: boolean = false,
) => {
  if (val === 0) return "0";
  const formatted = new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: FORMAT_CONFIG.MAX_FRACTION_DIGITS,
  }).format(val);
  if (isCurrency) return formatted + "원";
  if (isPercent) return formatted + "%";
  return formatted;
};

/**
 * 축의 숫자 라벨을 축약형(1만, 100만 등)으로 포맷팅합니다.
 * @param val 변환할 숫자
 */
export const formatTick = (val: number) => {
  return new Intl.NumberFormat("ko-KR", { notation: "compact" }).format(val);
};

/**
 * 지표(Metric) 타입에 따라 포맷팅을 다르게 적용합니다.
 * ROAS와 CTR은 %, 그 외(CPC 등)는 원 단위로 변환합니다.
 * @param metric 지표 타입 ('roas', 'ctr', 'cpc')
 * @param val 변환할 숫자
 */
export const getMetricFormat = (
  metric: "roas" | "ctr" | "cpc",
  val: number,
) => {
  if (metric === "roas" || metric === "ctr") return `${val}%`;
  return `${val}원`;
};

/**
 * 숫자 입력 필드(type="text")에서 숫자(0-9) 이외의 문자를 제거합니다.
 * @param value 사용자가 입력한 원본 문자열
 */
export const sanitizeNumericInput = (value: string): string =>
  value.replace(/[^0-9]/g, "");

/**
 * 순수 숫자 문자열을 input 표시용 천 단위 콤마 형식으로 변환합니다.
 * 저장값은 그대로 두고 value prop에만 사용하세요.
 * @example "1000000000" → "1,000,000,000"
 */
export const formatNumericDisplay = (value: string | number): string => {
  const digits = String(value).replace(/[^0-9]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
};
