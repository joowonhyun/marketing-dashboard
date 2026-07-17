# NestJS Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **This project's execution mode is PAIR PROGRAMMING, not autonomous execution.** The human (a 4-year frontend dev, new to NestJS) writes the actual code by hand to learn NestJS. The agent's role per step is: explain the concept in 2-3 sentences, show the exact code the step requires (so the human can compare/fix, not guess), then wait for the human to write it and run the verification command themselves before moving on. Do not use Write/Edit to create the human's source files unless they explicitly ask you to just do it. Reviewing (Read) and running verification commands together is fine.

**Goal:** Replace `json-server` with a running local NestJS + PostgreSQL backend: project scaffold, Prisma schema, Docker-based local Postgres, and a seed script that loads `db.json`'s 80 campaigns / 1,422 daily stats / 1 admin user into real tables. No API business logic (auth, campaigns, daily-stats routes) yet — that's Plans 2-3.

**Architecture:** `server/` is a new, independent NestJS project living alongside the existing Next.js app in the same repo (no Nx/Turborepo). Local Postgres runs in Docker so the frontend's dev data can't be corrupted by backend experiments. `PrismaService` wraps `PrismaClient` as an injectable NestJS provider; a `/health` endpoint proves the DI wiring and DB connection work end-to-end before any real feature is built.

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL 16 (Docker), pnpm, Jest (ships with Nest scaffold), bcrypt, ts-node (for the seed script).

## Global Constraints

- Package manager is **pnpm** everywhere (repo already uses `pnpm-lock.yaml` / `pnpm-workspace.yaml`) — never `npm install` / `yarn`.
- Root frontend `tsconfig.json` has `"strict": true` — the new `server/tsconfig.json` (Nest default) also ships with `strict: true`; do not weaken it.
- `server/` is a separate npm project with its own `package.json`/`node_modules`, not a pnpm workspace member (`pnpm-workspace.yaml` currently only lists build-dependency overrides, not workspace packages) — install its deps by `cd server && pnpm install`, not from the repo root.
- Prisma enum `CampaignStatus` must have exactly 5 values: `active`, `paused`, `ended`, `stopped`, `running` (confirmed against live `db.json`: counts are active=31, ended=26, paused=21, stopped=1, running=1 — decided with the user to keep `running` as a real status rather than collapsing it into `active`).
- `db.json` (repo root, one level above `server/`) is the seed source of truth: 80 campaigns, 1,422 daily_stats. Seed script must be idempotent (safe to re-run) via `upsert`.
- `budget` in `db.json` is mixed type (`int | null | "2000000원"` string with a `원` suffix) — must normalize to `Int | null` in Prisma, never throw on the malformed value.
- Never commit `server/.env` (already covered by root `.gitignore`'s `.env*` rule) — commit `server/.env.example` instead with placeholder values only.
- No new features beyond this plan's scope (no auth, no CRUD routes yet — those are Plan 2/3). Don't add anything not listed in a task below.

---

## Prerequisite (do this before Task 1)

Docker is not installed on this machine yet. Install Docker Desktop and make sure it's actually running (the whale icon in the menu bar) before Task 1:

```bash
brew install --cask docker
open -a Docker
```

Wait for Docker Desktop to finish starting, then confirm:

```bash
docker --version
docker compose version
```

Both must print a version number (not "command not found") before continuing.

---

### Task 1: Local Postgres via Docker Compose

**Files:**
- Create: `docker-compose.yml` (repo root)

**Interfaces:**
- Produces: a Postgres 16 instance reachable at `postgresql://dashboard:dashboard@localhost:5432/marketing_dashboard`, used by `server/.env`'s `DATABASE_URL` in Task 3.

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: dashboard
      POSTGRES_PASSWORD: dashboard
      POSTGRES_DB: marketing_dashboard
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

- [ ] **Step 2: Start it**

Run: `docker compose up -d`
Expected: `[+] Running 2/2` with `postgres` container `Started`/`Healthy`.

- [ ] **Step 3: Verify connectivity**

Run: `docker compose exec postgres psql -U dashboard -d marketing_dashboard -c '\dt'`
Expected: `Did not find any relations.` (empty DB, but connection succeeded — proves credentials/port are correct before Prisma touches it).

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add local Postgres via Docker Compose"
```

---

### Task 2: NestJS project scaffold

**Files:**
- Create: `server/` (entire NestJS CLI-generated project)
- Modify: `server/src/main.ts`

**Interfaces:**
- Produces: a runnable Nest app listening on port `3001` by default (same port `json-server` used, so `shared/constants/api.ts`'s `API_BASE_URL = "http://127.0.0.1:3001"` needs zero changes later in Plan 4).

- [ ] **Step 1: Scaffold the project**

Run from the repo root:
```bash
npx -y @nestjs/cli@11 new server --package-manager pnpm --skip-git
```
Expected: `server/` directory created with `src/`, `test/`, `package.json`, `nest-cli.json`, `tsconfig.json`, and dependencies already installed via pnpm.

- [ ] **Step 2: Point the default port at 3001**

Edit `server/src/main.ts` — the generated file looks like this:
```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```
Change the fallback port to `3001`:
```ts
  await app.listen(process.env.PORT ?? 3001);
```

- [ ] **Step 3: Run it and verify**

Run: `cd server && pnpm run start:dev`
Expected: console shows `Nest application successfully started`, listening on port 3001.

In a second terminal: `curl http://localhost:3001`
Expected: `Hello World!`

- [ ] **Step 4: Run the generated test suites (sanity check before we add anything)**

Run: `pnpm test` (unit) and `pnpm run test:e2e` (e2e) from inside `server/`
Expected: both pass (1 test each, the CLI-generated `app.controller.spec.ts` / `app.e2e-spec.ts`).

- [ ] **Step 5: Commit**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server
git commit -m "feat: scaffold NestJS server project"
```

---

### Task 3: Prisma schema + migration

**Files:**
- Create: `server/prisma/schema.prisma`
- Create: `server/.env` (not committed)
- Create: `server/.env.example`
- Modify: `server/.gitignore` (verify `.env` is covered; Nest's default already ignores `.env`)

**Interfaces:**
- Consumes: Postgres from Task 1 at `postgresql://dashboard:dashboard@localhost:5432/marketing_dashboard`.
- Produces: `Admin`, `Campaign`, `DailyStat` tables and `CampaignStatus`/`Platform` enums, migration files under `server/prisma/migrations/`, used by `PrismaService` in Task 4 and `seed.ts` in Task 6.

- [ ] **Step 1: Install Prisma**

Run inside `server/`:
```bash
pnpm add -D prisma
pnpm add @prisma/client
npx prisma init --datasource-provider postgresql
```
Expected: creates `server/prisma/schema.prisma` (default) and `server/.env` with a placeholder `DATABASE_URL`.

- [ ] **Step 2: Set the real connection string**

Edit `server/.env`:
```
DATABASE_URL="postgresql://dashboard:dashboard@localhost:5432/marketing_dashboard?schema=public"
```

Create `server/.env.example` (this one IS committed) with placeholders:
```
DATABASE_URL="postgresql://dashboard:dashboard@localhost:5432/marketing_dashboard?schema=public"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="change-me-before-seeding"
JWT_SECRET="change-me"
JWT_REFRESH_SECRET="change-me"
```
(`ADMIN_EMAIL`/`ADMIN_PASSWORD` are used in Task 6; `JWT_*` are placeholders for Plan 2 — add now so `.env.example` stays a single source of truth for every env var the backend will need.)

- [ ] **Step 3: Replace `server/prisma/schema.prisma` with the real schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Admin {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
}

enum CampaignStatus {
  active
  paused
  ended
  stopped
  running
}

enum Platform {
  Google
  Naver
  Meta
}

model Campaign {
  id         String          @id
  name       String?
  status     CampaignStatus
  platform   Platform
  budget     Int?
  startDate  DateTime?
  endDate    DateTime?
  dailyStats DailyStat[]
}

model DailyStat {
  id               String   @id
  campaignId       String
  campaign         Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  date             DateTime
  impressions      Int
  clicks           Int
  conversions      Int
  cost             Int
  conversionsValue Int
}
```

- [ ] **Step 4: Run the migration**

Run inside `server/`: `npx prisma migrate dev --name init`
Expected: `Your database is now in sync with your schema.` + a new `server/prisma/migrations/<timestamp>_init/migration.sql` file.

- [ ] **Step 5: Verify tables exist**

Run: `docker compose exec postgres psql -U dashboard -d marketing_dashboard -c '\dt'`
Expected: lists `Admin`, `Campaign`, `DailyStat`, and `_prisma_migrations`.

- [ ] **Step 6: Commit**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/prisma server/.env.example
git commit -m "feat: add Prisma schema and initial migration"
```

---

### Task 4: PrismaService + health check (TDD)

**Files:**
- Create: `server/src/prisma/prisma.service.ts`
- Create: `server/src/prisma/prisma.module.ts`
- Create: `server/src/health/health.controller.ts`
- Create: `server/test/health.e2e-spec.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `@prisma/client`'s generated `PrismaClient` (from Task 3's migration).
- Produces: `PrismaService` (injectable, `server/src/prisma/prisma.service.ts`), importable via `PrismaModule` — Plan 2's `AuthModule` and Plan 3's `CampaignsModule`/`DailyStatsModule` will inject this same `PrismaService` into their own services.

- [ ] **Step 1: Write the failing e2e test first**

`server/test/health.e2e-spec.ts`:
```ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/health (GET) returns ok and proves DB connectivity', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd server && pnpm run test:e2e`
Expected: FAIL — `Cannot GET /health` (404), because the controller doesn't exist yet.

- [ ] **Step 3: Write `PrismaService`**

`server/src/prisma/prisma.service.ts`:
```ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 4: Write `PrismaModule` (global, so every future feature module can inject `PrismaService` without re-importing it)**

`server/src/prisma/prisma.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 5: Write the health controller**

`server/src/health/health.controller.ts`:
```ts
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}
```

- [ ] **Step 6: Wire both modules into `AppModule`**

`server/src/app.module.ts` — add the imports and controller:
```ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 7: Install supertest types if missing, then run the e2e test again**

Run: `pnpm add -D @types/supertest` (skip if already present in the Nest-generated `package.json`)
Run: `pnpm run test:e2e`
Expected: PASS — `/health (GET) returns ok and proves DB connectivity`.

- [ ] **Step 8: Commit**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/src server/test
git commit -m "feat: add PrismaService and /health endpoint with e2e test"
```

---

### Task 5: Budget normalization utility (TDD)

**Files:**
- Create: `server/src/prisma/seed-utils.ts`
- Create: `server/src/prisma/seed-utils.spec.ts`

**Interfaces:**
- Produces: `normalizeBudget(raw: number | string | null): number | null`, consumed by `server/prisma/seed.ts` in Task 6.

- [ ] **Step 1: Write the failing unit test**

`server/src/prisma/seed-utils.spec.ts`:
```ts
import { normalizeBudget } from './seed-utils';

describe('normalizeBudget', () => {
  it('passes through a plain integer', () => {
    expect(normalizeBudget(20000000)).toBe(20000000);
  });

  it('returns null for null input', () => {
    expect(normalizeBudget(null)).toBeNull();
  });

  it('strips a trailing 원 suffix and parses the number', () => {
    expect(normalizeBudget('2000000원')).toBe(2000000);
  });

  it('returns null for a string with no parseable digits', () => {
    expect(normalizeBudget('abc')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd server && pnpm test seed-utils`
Expected: FAIL — `Cannot find module './seed-utils'`.

- [ ] **Step 3: Implement it**

`server/src/prisma/seed-utils.ts`:
```ts
export function normalizeBudget(raw: number | string | null): number | null {
  if (raw === null) return null;
  if (typeof raw === 'number') return raw;

  const digitsOnly = raw.replace(/[^0-9]/g, '');
  if (digitsOnly === '') return null;

  return parseInt(digitsOnly, 10);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm test seed-utils`
Expected: PASS — 4/4 tests green.

- [ ] **Step 5: Commit**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/src/prisma/seed-utils.ts server/src/prisma/seed-utils.spec.ts
git commit -m "feat: add normalizeBudget seed utility with tests"
```

---

### Task 6: Seed script (db.json → Postgres) + Admin seeding

**Files:**
- Create: `server/prisma/seed.ts`
- Modify: `server/package.json` (add `prisma.seed` config + `ts-node`/`bcrypt` deps)

**Interfaces:**
- Consumes: `normalizeBudget` (Task 5), `PrismaClient` (Task 3), `db.json` at repo root (one level above `server/`).
- Produces: a populated database — 80 `Campaign` rows, 1,422 `DailyStat` rows, 1 `Admin` row — that Plan 2 (auth) and Plan 3 (campaigns/daily-stats API) will read from.

- [ ] **Step 1: Install seed-time dependencies**

Run inside `server/`:
```bash
pnpm add bcrypt
pnpm add -D @types/bcrypt ts-node
```

- [ ] **Step 2: Tell Prisma how to run the seed script**

Edit `server/package.json` — add a top-level `"prisma"` key (sibling to `"dependencies"`):
```json
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
```

- [ ] **Step 3: Write the seed script**

`server/prisma/seed.ts`:
```ts
import { PrismaClient, CampaignStatus, Platform } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { normalizeBudget } from '../src/prisma/seed-utils';

const prisma = new PrismaClient();

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
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  conversionsValue: number;
}

async function main() {
  const dbJsonPath = path.resolve(process.cwd(), '../db.json');
  const raw = JSON.parse(fs.readFileSync(dbJsonPath, 'utf-8')) as {
    campaigns: RawCampaign[];
    daily_stats: RawDailyStat[];
  };

  for (const c of raw.campaigns) {
    await prisma.campaign.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        status: c.status as CampaignStatus,
        platform: c.platform as Platform,
        budget: normalizeBudget(c.budget),
        startDate: c.startDate ? new Date(c.startDate) : null,
        endDate: c.endDate ? new Date(c.endDate) : null,
      },
      create: {
        id: c.id,
        name: c.name,
        status: c.status as CampaignStatus,
        platform: c.platform as Platform,
        budget: normalizeBudget(c.budget),
        startDate: c.startDate ? new Date(c.startDate) : null,
        endDate: c.endDate ? new Date(c.endDate) : null,
      },
    });
  }
  console.log(`Seeded ${raw.campaigns.length} campaigns`);

  for (const d of raw.daily_stats) {
    await prisma.dailyStat.upsert({
      where: { id: d.id },
      update: {
        campaignId: d.campaignId,
        date: new Date(d.date),
        impressions: d.impressions,
        clicks: d.clicks,
        conversions: d.conversions,
        cost: d.cost,
        conversionsValue: d.conversionsValue,
      },
      create: {
        id: d.id,
        campaignId: d.campaignId,
        date: new Date(d.date),
        impressions: d.impressions,
        clicks: d.clicks,
        conversions: d.conversions,
        cost: d.cost,
        conversionsValue: d.conversionsValue,
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 4: Set real admin credentials for local dev**

Edit `server/.env` (not committed) and set actual values, e.g.:
```
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="pick-a-real-local-password"
```

- [ ] **Step 5: Run the seed**

Run inside `server/`: `npx prisma db seed`
Expected output ends with:
```
Seeded 80 campaigns
Seeded 1422 daily stats
Seeded admin: admin@example.com
```

- [ ] **Step 6: Verify counts directly against Postgres**

Run:
```bash
docker compose exec postgres psql -U dashboard -d marketing_dashboard -c \
  'SELECT (SELECT COUNT(*) FROM "Campaign") AS campaigns, (SELECT COUNT(*) FROM "DailyStat") AS daily_stats, (SELECT COUNT(*) FROM "Admin") AS admins;'
```
Expected: `campaigns=80`, `daily_stats=1422`, `admins=1`.

- [ ] **Step 7: Re-run the seed to confirm idempotency**

Run: `npx prisma db seed` again.
Expected: same log output, no duplicate-key errors, counts unchanged (upsert, not insert).

- [ ] **Step 8: Commit**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/prisma/seed.ts server/package.json server/pnpm-lock.yaml
git commit -m "feat: add db.json seed script with admin bootstrap"
```

---

### Task 7: Extend frontend `CampaignStatus` to match the real data

**Files:**
- Modify: `shared/types/index.ts:4`
- Modify: `shared/utils/status.ts:3-22`
- Modify: `shared/constants/options.ts:4-8`

**Interfaces:**
- Consumes: nothing new.
- Produces: `CampaignStatus` type now includes `"stopped" | "running"`, consumed by every file already importing it (`STATUS_CONFIG`, `STATUS_OPTIONS`, filter store, table components) — this task's whole point is making the TypeScript compiler force those call sites to handle the two extra values instead of silently rendering `null`/blank badges for the 2 real campaigns (`db.json`) that have them.

- [ ] **Step 1: Widen the type**

`shared/types/index.ts:4` — change:
```ts
export type CampaignStatus = "active" | "paused" | "ended";
```
to:
```ts
export type CampaignStatus = "active" | "paused" | "ended" | "stopped" | "running";
```

- [ ] **Step 2: Try to typecheck (expect it to fail — this is the point)**

Run from repo root: `pnpm exec tsc --noEmit`
Expected: FAIL — error in `shared/utils/status.ts` because `STATUS_CONFIG` is typed `Record<CampaignStatus, ...>` and is now missing the `stopped`/`running` keys. This is TypeScript catching the exact bug the design doc warned about.

- [ ] **Step 3: Add the missing `STATUS_CONFIG` entries**

`shared/utils/status.ts` — add after the existing `ended` entry (before the closing `};` of `STATUS_CONFIG`):
```ts
  stopped: {
    label: "중지됨",
    className:
      "whitespace-nowrap px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-semibold",
  },
  running: {
    label: "실행중",
    className:
      "whitespace-nowrap px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-semibold",
  },
```

- [ ] **Step 4: Add the missing `STATUS_OPTIONS` entries (so the filter dropdown can filter by them too)**

`shared/constants/options.ts` — add to the `STATUS_OPTIONS` array, after `{ label: "종료", value: "ended" }`:
```ts
  { label: "중지됨", value: "stopped" },
  { label: "실행중", value: "running" },
```

- [ ] **Step 5: Typecheck and lint again**

Run: `pnpm exec tsc --noEmit`
Expected: PASS, no errors.

Run: `pnpm lint`
Expected: PASS, no errors.

- [ ] **Step 6: Commit**

```bash
git add shared/types/index.ts shared/utils/status.ts shared/constants/options.ts
git commit -m "feat: support stopped/running campaign statuses in frontend types"
```

---

## Definition of Done for this plan

- [ ] `docker compose ps` shows a healthy `postgres` container.
- [ ] `cd server && pnpm run start:dev` boots without errors; `curl http://localhost:3001/health` returns `{"status":"ok"}`.
- [ ] `pnpm test` and `pnpm run test:e2e` (inside `server/`) both pass.
- [ ] Postgres has 80 campaigns, 1,422 daily stats, 1 admin (verified via `psql` count query).
- [ ] Root `pnpm exec tsc --noEmit` and `pnpm lint` both pass with the widened `CampaignStatus`.
- [ ] Nothing from Plan 2 (auth) or Plan 3 (campaigns/daily-stats routes) exists yet — `server/src` only has `app.*`, `prisma/`, `health/`.
