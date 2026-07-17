import 'dotenv/config';
import { PrismaClient, CampaignStatus, Platform } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import {
  normalizeBudget,
  normalizeStatus,
  normalizePlatform,
  normalizeNumber,
  computeDateShiftDays,
  shiftDate,
} from '../src/prisma/seed-utils';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

interface RawCampaign {
  id: string;
  name: string | null;
  status: string;
  platform: string;
  budget: number | string | null;
  startDate: string | null;
  endDate: string | null;
}

interface RawDailyStat {
  id: string;
  campaignId: string;
  date: string;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  cost: number | null;
  conversionsValue: number | null;
}

const main = async () => {
  const dbJsonPath = path.resolve(process.cwd(), '../db.json');
  const raw = JSON.parse(fs.readFileSync(dbJsonPath, 'utf-8')) as {
    campaigns: RawCampaign[];
    daily_stats: RawDailyStat[];
  };

  const allDates = [
    ...raw.campaigns.flatMap((c) => [c.startDate, c.endDate]),
    ...raw.daily_stats.map((d) => d.date),
  ]
    .filter((d): d is string => Boolean(d))
    .map((d) => new Date(d));
  const shiftDays = computeDateShiftDays(allDates);
  console.log(`날짜를 오늘 기준으로 ${shiftDays}일만큼 이동합니다.`);

  const shiftDateString = (d: string | null): Date | null =>
    d ? shiftDate(new Date(d), shiftDays) : null;

  for (const c of raw.campaigns) {
    await prisma.campaign.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        status: normalizeStatus(c.status) as CampaignStatus,
        platform: normalizePlatform(c.platform) as Platform,
        budget: normalizeBudget(c.budget),
        startDate: shiftDateString(c.startDate),
        endDate: shiftDateString(c.endDate),
      },
      create: {
        id: c.id,
        name: c.name,
        status: normalizeStatus(c.status) as CampaignStatus,
        platform: normalizePlatform(c.platform) as Platform,
        budget: normalizeBudget(c.budget),
        startDate: shiftDateString(c.startDate),
        endDate: shiftDateString(c.endDate),
      },
    });
  }
  console.log(`Seeded ${raw.campaigns.length} campaigns`);

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
  console.log(`Seeded ${raw.daily_stats.length} daily stats`);

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in server/.env before seeding');
  }
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.admin.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: { email: adminEmail, passwordHash },
  });
  console.log(`Seeded admin: ${adminEmail}`);
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
