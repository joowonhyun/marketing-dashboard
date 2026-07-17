export const normalizeBudget = (raw: number | string | null): number | null => {
  if (raw === null) return null;
  if (typeof raw === 'number') return raw;

  const digitsOnly = raw.replace(/[^0-9]/g, '');
  if (digitsOnly === '') return null;

  return parseInt(digitsOnly, 10);
};

// 프론트엔드 shared/utils/dataset.ts의 normalizeStatus와 동일한 규칙
// ("running"은 active로, "stopped"는 ended로 취급)을 Postgres 저장 시에도 적용.
export const normalizeStatus = (raw: string): 'active' | 'paused' | 'ended' => {
  const lower = raw.toLowerCase();
  if (lower === 'running') return 'active';
  if (lower === 'stopped') return 'ended';
  if (lower === 'active' || lower === 'paused' || lower === 'ended') return lower;
  return 'active';
};

const PLATFORM_MATCH_KEYWORDS: Record<'Google' | 'Naver' | 'Meta', string[]> = {
  Google: ['google'],
  Meta: ['facebook', 'meta'],
  Naver: ['naver', '네이버'],
};

// 프론트엔드 shared/utils/dataset.ts의 normalizePlatform과 동일한 매칭 규칙.
export const normalizePlatform = (raw: string): 'Google' | 'Naver' | 'Meta' => {
  const lower = raw.toLowerCase();
  const matched = (Object.keys(PLATFORM_MATCH_KEYWORDS) as Array<'Google' | 'Naver' | 'Meta'>).find(
    (key) => PLATFORM_MATCH_KEYWORDS[key].some((keyword) => lower.includes(keyword)),
  );
  return matched ?? 'Google';
};

// 프론트엔드 shared/utils/dataset.ts의 normalizeNumber와 동일 (null/undefined는 0으로 처리).
export const normalizeNumber = (raw: number | null | undefined): number => {
  if (raw === null || raw === undefined) return 0;
  return raw;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// db.json은 특정 연도에 고정된 목업 날짜를 담고 있어 시간이 지나면
// 대시보드 기본 필터("이번 달")에서 데이터가 하나도 안 보이게 된다.
// 전체 날짜 범위의 중간 지점을 시딩 시점의 "오늘"로 옮기고, 나머지 날짜는
// 같은 간격만큼 평행이동시켜서 시딩할 때마다 데이터가 항상 "오늘" 근처에 오도록 한다.
export const computeDateShiftDays = (allDates: Date[]): number => {
  const times = allDates.map((d) => d.getTime());
  const midpoint = (Math.min(...times) + Math.max(...times)) / 2;
  const today = Date.now();
  return Math.round((today - midpoint) / MS_PER_DAY);
};

export const shiftDate = (date: Date, shiftDays: number): Date =>
  new Date(date.getTime() + shiftDays * MS_PER_DAY);
