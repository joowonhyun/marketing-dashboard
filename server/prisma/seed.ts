import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { applySeedDataset, loadSeedDataset } from '../src/prisma/seed-utils';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const main = async () => {
  const raw = loadSeedDataset();
  const { campaignCount, dailyStatCount } = await applySeedDataset(prisma, raw);
  console.log(`캠페인 ${campaignCount}개 시딩 완료`);
  console.log(`일별 통계 ${dailyStatCount}개 시딩 완료`);

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error('시딩 전에 server/.env에 ADMIN_EMAIL과 ADMIN_PASSWORD를 설정해야 합니다.');
  }
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.admin.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: { email: adminEmail, passwordHash },
  });
  console.log(`관리자 계정 시딩 완료: ${adminEmail}`);
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
