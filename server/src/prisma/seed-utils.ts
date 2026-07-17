import * as fs from 'fs';
import * as path from 'path';
import type { PrismaClient } from '../../generated/prisma/client';

export interface RawCampaign {
  id: string;
  name: string | null;
  status: string;
  platform: string;
  budget: number | string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface RawDailyStat {
  id: string;
  campaignId: string;
  date: string;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  cost: number | null;
  conversionsValue: number | null;
}

export interface SeedDataset {
  campaigns: RawCampaign[];
  daily_stats: RawDailyStat[];
}

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
  if (lower === 'active' || lower === 'paused' || lower === 'ended')
    return lower;
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
  const matched = (
    Object.keys(PLATFORM_MATCH_KEYWORDS) as Array<'Google' | 'Naver' | 'Meta'>
  ).find((key) =>
    PLATFORM_MATCH_KEYWORDS[key].some((keyword) => lower.includes(keyword)),
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

// server/ 기준 한 단계 위(repo 루트)의 db.json을 읽는다.
export const loadSeedDataset = (): SeedDataset => {
  const dbJsonPath = path.resolve(process.cwd(), '../db.json');
  return JSON.parse(fs.readFileSync(dbJsonPath, 'utf-8')) as SeedDataset;
};

// DB 상태를 db.json 원본과 정확히 일치시킨다: db.json에 없는 캠페인(방문자가
// 새로 등록한 것)은 삭제하고, db.json에 있는 캠페인/일별 통계는 upsert로
// 원본 값으로 되돌린다. Admin 테이블은 건드리지 않는다 — 최초 시딩(seed.ts)과
// 주기적 리셋(ResetService) 양쪽에서 공용으로 사용.
export const applySeedDataset = async (
  prisma: PrismaClient,
  raw: SeedDataset,
): Promise<{ campaignCount: number; dailyStatCount: number }> => {
  const originalCampaignIds = raw.campaigns.map((c) => c.id);
  await prisma.campaign.deleteMany({
    where: { id: { notIn: originalCampaignIds } },
  });

  const allDates = [
    ...raw.campaigns.flatMap((c) => [c.startDate, c.endDate]),
    ...raw.daily_stats.map((d) => d.date),
  ]
    .filter((d): d is string => Boolean(d))
    .map((d) => new Date(d));
  const shiftDays = computeDateShiftDays(allDates);

  const shiftDateString = (d: string | null): Date | null =>
    d ? shiftDate(new Date(d), shiftDays) : null;

  for (const c of raw.campaigns) {
    await prisma.campaign.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        status: normalizeStatus(c.status),
        platform: normalizePlatform(c.platform),
        budget: normalizeBudget(c.budget),
        startDate: shiftDateString(c.startDate),
        endDate: shiftDateString(c.endDate),
      },
      create: {
        id: c.id,
        name: c.name,
        status: normalizeStatus(c.status),
        platform: normalizePlatform(c.platform),
        budget: normalizeBudget(c.budget),
        startDate: shiftDateString(c.startDate),
        endDate: shiftDateString(c.endDate),
      },
    });
  }

  for (const d of raw.daily_stats) {
    const date = shiftDateString(d.date) as Date;
    await prisma.dailyStat.upsert({
      where: { id: d.id },
      update: {
        campaign: { connect: { id: d.campaignId } },
        date,
        impressions: normalizeNumber(d.impressions),
        clicks: normalizeNumber(d.clicks),
        conversions: normalizeNumber(d.conversions),
        cost: normalizeNumber(d.cost),
        conversionsValue: normalizeNumber(d.conversionsValue),
      },
      create: {
        id: d.id,
        campaign: { connect: { id: d.campaignId } },
        date,
        impressions: normalizeNumber(d.impressions),
        clicks: normalizeNumber(d.clicks),
        conversions: normalizeNumber(d.conversions),
        cost: normalizeNumber(d.cost),
        conversionsValue: normalizeNumber(d.conversionsValue),
      },
    });
  }

  return {
    campaignCount: raw.campaigns.length,
    dailyStatCount: raw.daily_stats.length,
  };
};
