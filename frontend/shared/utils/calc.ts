/**
 * 무한대(Infinity)나 NaN 에러를 방지하기 위한 안전한 나눗셈 유틸리티
 */
export const safeDivide = (numerator: number, denominator: number): number => {
  const num = Number(numerator) || 0;
  const den = Number(denominator) || 0;
  if (!den || isNaN(den) || den === 0) {
    return 0;
  }
  return num / den;
};

/**
 * 클릭률(CTR) 계산 (퍼센티지 타입 반환)
 */
export const calculateCTR = (clicks: number, impressions: number): number => {
  return safeDivide(clicks, impressions) * 100;
};

/**
 * 클릭당 비용(CPC) 계산
 */
export const calculateCPC = (cost: number, clicks: number): number => {
  return safeDivide(cost, clicks);
};

/**
 * 광고 지출 대비 수익률(ROAS) 계산 (퍼센티지 타입 반환)
 */
export const calculateROAS = (conversionsValue: number, cost: number): number => {
  return safeDivide(conversionsValue, cost) * 100;
};
