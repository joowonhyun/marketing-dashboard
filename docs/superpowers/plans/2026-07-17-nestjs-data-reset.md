# 데이터 리셋 기능 구현 계획

> **에이전트 작업자용:** 이 계획을 태스크 단위로 실행할 때는 superpowers:subagent-driven-development(추천) 또는 superpowers:executing-plans 서브스킬을 사용할 것. 각 스텝은 체크박스(`- [ ]`) 문법으로 추적한다.
>
> **실행 방식: TDD 없이 바로 구현** (Plan 2/3/4와 동일) — 구현하고 curl/psql로 검증.

**목표:** 배포 후 회원가입 없는 단일 admin 계정을 방문자(테스터/면접관)가 공유하게 되므로, 누군가 캠페인을 등록/삭제/상태변경해서 어지럽혀도 자동으로 원본 상태(`db.json`)로 되돌아오게 한다. 매일 00:00(Asia/Seoul)에 자동 리셋 + 필요할 때 즉시 실행 가능한 수동 리셋 엔드포인트를 추가한다. 배포(Plan 6) 착수 전에 먼저 완료한다.

**배경(왜 필요한가):** 기존 `server/prisma/seed.ts`는 `upsert`라서 재실행하면 원본 80개 캠페인의 필드값(`status` 등)은 복구되고 삭제됐던 원본도 재생성되지만, 방문자가 **새로 등록한 캠페인**(`CAMP-XXXXXX` id, `db.json`에 없음)은 손대지 않는다. 즉 완전한 리셋이 아니다. 이번 계획은 "db.json에 없는 캠페인은 삭제 + db.json에 있는 건 upsert로 원복"하는 로직을 만들어 `seed.ts`(최초/로컬 시딩)와 새 `ResetService`(운영 중 주기 리셋) 양쪽에서 공용으로 쓴다. `DailyStat`은 생성/삭제 API 자체가 없으므로(오직 `GET /daily-stats`) 방문자가 직접 오염시킬 수 없다 — 캠페인 삭제 시 FK cascade로 같이 지워지는 것 외엔 항상 upsert로 원본 유지.

**기술 스택:** `@nestjs/schedule`(신규 의존성, `@Cron` 데코레이터). 기존 Prisma/PrismaService 재사용.

## 전역 제약사항

- `Admin` 테이블은 리셋 대상에서 완전히 제외 — 관리자 계정/비밀번호는 절대 건드리지 않는다.
- 리셋 로직은 `seed.ts`와 `ResetService`가 동일한 함수를 호출해야 한다(로직 두 곳에 중복 금지).
- `POST /admin/reset`은 인증이 필요하다 — `@Public()`을 붙이지 않아 전역 `JwtAuthGuard`가 그대로 보호하게 둔다(신규 가드 불필요).
- 자동 리셋 스케줄은 `0 0 * * *`(매일 00:00), 타임존은 `Asia/Seoul`로 명시.
- 화살표 함수 사용(함수 선언문 지양), 주석/커밋 메시지는 한글 — 세션 컨벤션 유지.

---

### Task 1: `seed-utils.ts`에 공용 리셋 로직 추출 + `seed.ts` 리팩터링

**파일:**
- 수정: `server/src/prisma/seed-utils.ts`
- 수정: `server/prisma/seed.ts`
- 테스트(기존 유지 확인): `server/src/prisma/seed-utils.spec.ts`

**인터페이스:**
- 산출물: `loadSeedDataset(): SeedDataset`(repo 루트 `db.json`을 읽어 파싱), `applySeedDataset(prisma: PrismaClient, raw: SeedDataset): Promise<{ campaignCount: number; dailyStatCount: number }>`(db.json에 없는 캠페인 삭제 + campaigns/daily_stats upsert) — Task 2의 `ResetService`가 그대로 소비.

- [ ] **Step 1: `seed-utils.ts`에 타입 + 공용 함수 추가**

`server/src/prisma/seed-utils.ts` 최상단에 import와 타입, 파일 하단에 두 함수를 추가(기존 `normalizeBudget`/`normalizeStatus`/`normalizePlatform`/`normalizeNumber`/`computeDateShiftDays`/`shiftDate`는 그대로 유지):

```ts
import * as fs from 'fs';
import * as path from 'path';
import type { PrismaClient, CampaignStatus, Platform } from '../../generated/prisma/client';

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
```

파일 맨 끝에 추가:

```ts
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
  await prisma.campaign.deleteMany({ where: { id: { notIn: originalCampaignIds } } });

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

  return { campaignCount: raw.campaigns.length, dailyStatCount: raw.daily_stats.length };
};
```

- [ ] **Step 2: `seed.ts`를 공용 함수를 쓰도록 단순화**

`server/prisma/seed.ts` 전체를 다음으로 교체:

```ts
import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { applySeedDataset, loadSeedDataset } from '../src/prisma/seed-utils';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const main = async () => {
  const raw = loadSeedDataset();
  const { campaignCount, dailyStatCount } = await applySeedDataset(prisma, raw);
  console.log(`Seeded ${campaignCount} campaigns`);
  console.log(`Seeded ${dailyStatCount} daily stats`);

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
```

- [ ] **Step 3: 기존 단위 테스트 통과 확인**

`server/` 안에서 실행: `pnpm test`
기대 결과: `seed-utils.spec.ts`의 `normalizeBudget` 테스트 4개 전부 통과(리팩터링으로 기존 export 이름/시그니처는 안 바꿨으므로 영향 없어야 함).

- [ ] **Step 4: 로컬 DB에 재시딩 실행 + 멱등성/정리 동작 확인**

```bash
docker compose up -d
cd server
npx prisma db seed
```
기대 출력 끝부분: `Seeded 80 campaigns`, `Seeded 1422 daily stats`, `Seeded admin: admin@example.com`.

Postgres에서 카운트 확인:
```bash
docker compose exec postgres psql -U dashboard -d marketing_dashboard -c \
  'SELECT (SELECT COUNT(*) FROM "Campaign") AS campaigns, (SELECT COUNT(*) FROM "DailyStat") AS daily_stats;'
```
기대 결과: `campaigns=80`, `daily_stats=1422`.

- [ ] **Step 5: 커밋**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/src/prisma/seed-utils.ts server/prisma/seed.ts
git commit -m "refactor: 시딩 로직을 seed-utils의 공용 함수로 추출(리셋 기능에서 재사용 목적)"
```

---

### Task 2: `@nestjs/schedule` 설치 + `ResetModule`(자동 매일 00시 리셋 + 수동 `POST /admin/reset`)

**파일:**
- 생성: `server/src/reset/reset.service.ts`
- 생성: `server/src/reset/reset.controller.ts`
- 생성: `server/src/reset/reset.module.ts`
- 수정: `server/src/app.module.ts`
- 수정: `server/package.json`(의존성 추가)

**인터페이스:**
- 소비: `applySeedDataset`, `loadSeedDataset`(Task 1), `PrismaService`(기존, `@Global()`이라 별도 import 불필요).
- 산출물: `ResetService.reset(): Promise<{ campaignCount: number; dailyStatCount: number }>`, `POST /admin/reset`(인증 필요, 응답 `{ message, campaignCount, dailyStatCount }`).

- [ ] **Step 1: 패키지 설치**

`server/` 안에서 실행: `pnpm add @nestjs/schedule`

- [ ] **Step 2: `ResetService` 작성**

`server/src/reset/reset.service.ts`:
```ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { applySeedDataset, loadSeedDataset } from '../prisma/seed-utils';

@Injectable()
export class ResetService {
  private readonly logger = new Logger(ResetService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 데모 계정 하나를 공유하는 구조라 방문자가 등록/삭제/변경한 데이터가
  // 계속 쌓이는 걸 막기 위해 매일 00:00(KST)에 db.json 원본 상태로 되돌린다.
  @Cron('0 0 * * *', { timeZone: 'Asia/Seoul' })
  async handleDailyReset() {
    const result = await this.reset();
    this.logger.log(
      `자동 리셋 완료: campaigns=${result.campaignCount}, dailyStats=${result.dailyStatCount}`,
    );
  }

  reset() {
    const raw = loadSeedDataset();
    return applySeedDataset(this.prisma, raw);
  }
}
```

- [ ] **Step 3: `ResetController` 작성**

`server/src/reset/reset.controller.ts`:
```ts
import { Controller, Post } from '@nestjs/common';
import { ResetService } from './reset.service';

// @Public() 없음 — 전역 JwtAuthGuard로 보호되어 관리자 로그인 없이는 호출 불가.
@Controller('admin')
export class ResetController {
  constructor(private readonly resetService: ResetService) {}

  @Post('reset')
  async reset() {
    const result = await this.resetService.reset();
    return { message: '리셋 완료', ...result };
  }
}
```

- [ ] **Step 4: `ResetModule` 작성**

`server/src/reset/reset.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ResetController } from './reset.controller';
import { ResetService } from './reset.service';

@Module({
  controllers: [ResetController],
  providers: [ResetService],
})
export class ResetModule {}
```

- [ ] **Step 5: `AppModule`에 등록**

`server/src/app.module.ts` 전체를 다음으로 교체:
```ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { CampaignsModule } from './campaigns/campaigns.module';
import { DailyStatsModule } from './daily-stats/daily-stats.module';
import { ResetModule } from './reset/reset.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    CampaignsModule,
    DailyStatsModule,
    ResetModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
```

- [ ] **Step 6: curl로 전체 흐름 검증**

개발 서버 재시작(`pnpm run start:dev`) 후:
```bash
# 1. 로그인해서 토큰 확보
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"<실제 ADMIN_PASSWORD>"}' \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['accessToken'])")

# 2. 리셋 전 캠페인 수 확인 (80이어야 함)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/campaigns | python3 -c "import json,sys;print(len(json.load(sys.stdin)))"

# 3. 캠페인 하나 추가로 등록 (오염 시뮬레이션)
curl -s -X POST http://localhost:3001/campaigns \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"테스트 오염 캠페인","platform":"Google","status":"active","budget":1000000,"startDate":"2026-07-01","endDate":"2026-07-31"}'
# 기대 결과: CAMP-XXXXXX id를 가진 캠페인 201 생성

# 4. 등록 확인 (81이어야 함)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/campaigns | python3 -c "import json,sys;print(len(json.load(sys.stdin)))"

# 5. 토큰 없이 리셋 시도 → 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/admin/reset

# 6. 토큰으로 리셋 실행
curl -s -X POST http://localhost:3001/admin/reset -H "Authorization: Bearer $TOKEN"
# 기대 결과: {"message":"리셋 완료","campaignCount":80,"dailyStatCount":1422}

# 7. 리셋 후 캠페인 수 재확인 (80으로 복구됐어야 함, 테스트 오염 캠페인 사라짐)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/campaigns | python3 -c "import json,sys;print(len(json.load(sys.stdin)))"
```
기대 결과: 2번=80, 4번=81, 5번=401, 7번=80.

**참고(이번 세션에서 검증 안 되는 부분):** `@Cron('0 0 * * *', ...)`이 실제로 매일 00:00(Asia/Seoul)에 발화하는지는 시간을 24시간 이상 기다려야 확인 가능해 이 세션에서는 미검증으로 남긴다 — 6번 curl로 `handleDailyReset()`이 호출하는 것과 동일한 `reset()` 로직이 정상 동작함을 확인했으므로 로직상으로는 문제없음. cron 표현식 자체는 `0 0 * * *`(분 시 일 월 요일 순서로 매일 0시 0분)로 표준 문법에 맞음.

- [ ] **Step 7: 커밋**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/src/reset server/src/app.module.ts server/package.json server/pnpm-lock.yaml
git commit -m "feat: 매일 00시 자동 데이터 리셋 + 수동 POST /admin/reset 엔드포인트 추가"
```

---

### Task 3: README에 데모 리셋 안내 문구 추가

**파일:**
- 수정: `README.md`

**인터페이스:**
- 소비: 없음(문서 전용).

- [ ] **Step 1: README에 안내 추가**

`README.md`에서 데모 계정 안내가 있는 섹션 근처에 다음 내용 추가(정확한 위치는 기존 데모 계정 안내 문단 바로 아래):

```markdown
> 이 프로젝트는 회원가입 없이 데모 계정 하나를 공유합니다. 캠페인 등록/상태변경/삭제를
> 자유롭게 테스트해 보세요 — 매일 00:00(KST)에 원본 데이터로 자동 초기화됩니다.
```

- [ ] **Step 2: 커밋**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add README.md
git commit -m "docs: 데모 데이터 자동 리셋 안내 추가"
```

---

## 이 계획의 완료 기준 (Definition of Done)

- [ ] `POST /admin/reset` 호출 시 db.json에 없는 캠페인(방문자가 새로 등록한 것)은 삭제되고, 원본 80개 캠페인/1,422개 daily_stats는 원본 값으로 복구됨. `Admin` 테이블은 변경 없음.
- [ ] 토큰 없이 `POST /admin/reset` 호출 → 401.
- [ ] `pnpm test` 통과(`seed-utils.spec.ts` 포함), `npx tsc --noEmit` 통과.
- [ ] `npx prisma db seed`(로컬/최초 배포 시딩용)가 리팩터링 후에도 동일하게 동작 — `Seeded 80 campaigns` / `Seeded 1422 daily stats` / `Seeded admin: ...` 출력.
- [ ] `@Cron('0 0 * * *', { timeZone: 'Asia/Seoul' })` 등록됨 — 실제 자정 발화는 미검증(위 Task 2 Step 6 참고), 기저 로직(`reset()`)은 수동 트리거로 검증 완료.
- [ ] README에 데모 리셋 안내 반영.
