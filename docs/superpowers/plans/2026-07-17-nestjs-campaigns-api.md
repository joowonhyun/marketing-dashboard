# NestJS Campaigns/DailyStats API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution mode: direct implementation, no TDD** (same as Plan 2) — implement, then verify with `curl`.

**Goal:** `GET/POST/PATCH/DELETE /campaigns` and `GET /daily-stats`, matching the existing frontend's exact call shapes (`fetchCampaigns`, `updateCampaignStatus`, `createCampaign`, `deleteCampaign`, `fetchDailyStats`) so Plan 4 can swap their internals with zero signature changes.

**Architecture:** Two feature modules (`CampaignsModule`, `DailyStatsModule`), each with a thin controller + service injecting `PrismaService`. Protected by the global `JwtAuthGuard` from Plan 2 automatically — no `@Public()`, no extra guard wiring needed.

**Tech Stack:** Same as Plan 1/2 — Nest 11, Prisma 7, class-validator.

## Global Constraints

- DTO validation must match `features/campaign/schemas/campaignFormSchema.ts` / `shared/constants/campaign.ts`'s `CAMPAIGN_LIMITS` exactly: name 2–100 chars, budget 100–1,000,000,000 (integer), `endDate > startDate`.
- **`cost` is not part of this API.** Confirmed by reading `useCampaignForm.ts:54-62`: the form validates `cost <= budget` client-side but never sends `cost` to `createCampaignAction` — it's not a `Campaign` field in `shared/types/index.ts` or `server/prisma/schema.prisma`. Don't add it.
- `PATCH /campaigns/:id` only ever changes `status` — matches the design doc ("현재도 status PATCH만 존재하며 그대로 유지") and the existing frontend, which has no other campaign-edit UI.
- `POST /campaigns` DTO must accept `status` too (not default it server-side): `features/campaign/services/api.ts`'s `createCampaign` sends `Omit<Campaign, "id">`, which includes `status` — the existing frontend (`useCampaignForm.ts:59`) always sends `"active"`, but the API contract shouldn't assume that.
- Response dates: Prisma returns JS `Date` objects; the frontend expects plain `"YYYY-MM-DD"` strings (matching the old `db.json`/json-server format — see `shared/types/index.ts`'s `startDate: string | null`). Format `startDate`/`endDate`/`date` back to `YYYY-MM-DD` in the service layer before returning, don't let them serialize as full ISO datetimes.
- Every route in this plan is protected by default (global `JwtAuthGuard` from Plan 2) — do not add `@Public()` anywhere here.

---

### Task 1: `CampaignsModule` — `GET /campaigns`, `POST /campaigns`

**Files:**
- Create: `server/src/campaigns/campaign.constants.ts`
- Create: `server/src/campaigns/dto/create-campaign.dto.ts`
- Create: `server/src/campaigns/campaigns.service.ts`
- Create: `server/src/campaigns/campaigns.controller.ts`
- Create: `server/src/campaigns/campaigns.module.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService` (Plan 1).
- Produces: `CampaignsService.findAll()`, `CampaignsService.create(dto)` — consumed by `CampaignsController` here, and implicitly by Plan 4's frontend `fetchCampaigns()`/`createCampaign()` once their internals point at this API.

- [ ] **Step 1: Mirror the frontend's validation limits**

`server/src/campaigns/campaign.constants.ts`:
```ts
// shared/constants/campaign.ts의 CAMPAIGN_LIMITS와 동일한 값 (프론트와 서버 이중 검증).
export const CAMPAIGN_LIMITS = {
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
  BUDGET_MIN: 100,
  BUDGET_MAX: 1000000000,
} as const;
```

- [ ] **Step 2: Write the create DTO**

`server/src/campaigns/dto/create-campaign.dto.ts`:
```ts
import { IsIn, IsInt, IsDateString, Length, Max, Min } from 'class-validator';
import { CAMPAIGN_LIMITS } from '../campaign.constants';

const PLATFORMS = ['Google', 'Naver', 'Meta'] as const;
const STATUSES = ['active', 'paused', 'ended'] as const;

export class CreateCampaignDto {
  @Length(CAMPAIGN_LIMITS.NAME_MIN_LENGTH, CAMPAIGN_LIMITS.NAME_MAX_LENGTH)
  name: string;

  @IsIn(PLATFORMS)
  platform: (typeof PLATFORMS)[number];

  @IsIn(STATUSES)
  status: (typeof STATUSES)[number];

  @IsInt()
  @Min(CAMPAIGN_LIMITS.BUDGET_MIN)
  @Max(CAMPAIGN_LIMITS.BUDGET_MAX)
  budget: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
```

- [ ] **Step 3: Write `CampaignsService`**

`server/src/campaigns/campaigns.service.ts`:
```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

const toDateOnly = (date: Date | null): string | null =>
  date ? date.toISOString().slice(0, 10) : null;

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const campaigns = await this.prisma.campaign.findMany({
      orderBy: { id: 'asc' },
    });
    return campaigns.map((c) => ({
      ...c,
      startDate: toDateOnly(c.startDate),
      endDate: toDateOnly(c.endDate),
    }));
  }

  async create(dto: CreateCampaignDto) {
    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('종료일은 시작일 이후여야 합니다.');
    }

    const id = `CAMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const campaign = await this.prisma.campaign.create({
      data: {
        id,
        name: dto.name,
        platform: dto.platform,
        status: dto.status,
        budget: dto.budget,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });

    return {
      ...campaign,
      startDate: toDateOnly(campaign.startDate),
      endDate: toDateOnly(campaign.endDate),
    };
  }
}
```
The `CAMP-XXXXXX` random ID generation is lifted as-is from the frontend's current `createCampaign` in `features/campaign/services/api.ts:25` — moving ID generation server-side (matching where the data actually lives now) rather than keeping it client-side.

- [ ] **Step 4: Write `CampaignsController`**

`server/src/campaigns/campaigns.controller.ts`:
```ts
import { Body, Controller, Get, Post } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  findAll() {
    return this.campaignsService.findAll();
  }

  @Post()
  create(@Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(dto);
  }
}
```

- [ ] **Step 5: Write `CampaignsModule` and register it**

`server/src/campaigns/campaigns.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

@Module({
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
```

`server/src/app.module.ts` — add `CampaignsModule` to `imports`.

- [ ] **Step 6: Verify with curl**

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"<ADMIN_PASSWORD from server/.env>"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['accessToken'])")

# List (expect 80 campaigns, startDate/endDate as "YYYY-MM-DD")
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/campaigns | python3 -m json.tool | head -20

# Create (expect 201-shaped campaign object back with a CAMP-XXXXXX id)
curl -s -X POST http://localhost:3001/campaigns -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"테스트 캠페인","platform":"Google","status":"active","budget":500000,"startDate":"2026-08-01","endDate":"2026-08-31"}'

# Validation failure (expect 400, {statusCode,message})
curl -s -X POST http://localhost:3001/campaigns -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"a","platform":"Google","status":"active","budget":500000,"startDate":"2026-08-01","endDate":"2026-08-31"}'
```

- [ ] **Step 7: Commit**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/src/campaigns server/src/app.module.ts
git commit -m "feat: Campaigns 목록 조회/등록 API 추가"
```

---

### Task 2: `PATCH /campaigns/:id` (status), `DELETE /campaigns/:id`

**Files:**
- Create: `server/src/campaigns/dto/update-campaign-status.dto.ts`
- Modify: `server/src/campaigns/campaigns.service.ts`
- Modify: `server/src/campaigns/campaigns.controller.ts`

**Interfaces:**
- Produces: `CampaignsService.updateStatus(id, dto)`, `CampaignsService.remove(id)`.

- [ ] **Step 1: Write the status DTO**

`server/src/campaigns/dto/update-campaign-status.dto.ts`:
```ts
import { IsIn } from 'class-validator';

const STATUSES = ['active', 'paused', 'ended'] as const;

export class UpdateCampaignStatusDto {
  @IsIn(STATUSES)
  status: (typeof STATUSES)[number];
}
```

- [ ] **Step 2: Add `updateStatus`/`remove` to `CampaignsService`**

Add to `server/src/campaigns/campaigns.service.ts`, alongside the existing `findAll`/`create`:
```ts
  async updateStatus(id: string, dto: UpdateCampaignStatusDto) {
    const campaign = await this.prisma.campaign.update({
      where: { id },
      data: { status: dto.status },
    });
    // findAll/create와 동일하게 날짜 포맷을 맞춰야 함 — 안 그러면 이 라우트만
    // 풀 ISO datetime을 돌려주는 불일치가 생김 (실제로 이 버그가 났었음).
    return {
      ...campaign,
      startDate: toDateOnly(campaign.startDate),
      endDate: toDateOnly(campaign.endDate),
    };
  }

  async remove(id: string) {
    await this.prisma.campaign.delete({ where: { id } });
  }
```
Add the import: `import { UpdateCampaignStatusDto } from './dto/update-campaign-status.dto';`

- [ ] **Step 3: Add the routes to `CampaignsController`**

Add to `server/src/campaigns/campaigns.controller.ts`:
```ts
  @Patch(':id')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateCampaignStatusDto) {
    return this.campaignsService.updateStatus(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.campaignsService.remove(id);
  }
```
Update the imports: `Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post` from `@nestjs/common`, and add `import { UpdateCampaignStatusDto } from './dto/update-campaign-status.dto';`.

- [ ] **Step 4: Verify with curl**

```bash
# Pick a real campaign id from the list first
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/campaigns | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])"

# PATCH status
curl -s -X PATCH http://localhost:3001/campaigns/<id> -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"paused"}'
# Expect the updated campaign with status "paused"

# DELETE the test campaign created in Task 1 (use its CAMP-XXXXXX id)
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:3001/campaigns/<CAMP-XXXXXX> -H "Authorization: Bearer $TOKEN"
# Expect 204
```

- [ ] **Step 5: Commit**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/src/campaigns
git commit -m "feat: Campaigns 상태 변경/삭제 API 추가"
```

---

### Task 3: `DailyStatsModule` — `GET /daily-stats`

**Files:**
- Create: `server/src/daily-stats/daily-stats.service.ts`
- Create: `server/src/daily-stats/daily-stats.controller.ts`
- Create: `server/src/daily-stats/daily-stats.module.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService`.
- Produces: `GET /daily-stats`, matching `features/dashboard/services/api.ts`'s `fetchDailyStats()`.

- [ ] **Step 1: Write `DailyStatsService`**

`server/src/daily-stats/daily-stats.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DailyStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const stats = await this.prisma.dailyStat.findMany({ orderBy: { id: 'asc' } });
    return stats.map((s) => ({ ...s, date: s.date.toISOString().slice(0, 10) }));
  }
}
```

- [ ] **Step 2: Write `DailyStatsController`**

`server/src/daily-stats/daily-stats.controller.ts`:
```ts
import { Controller, Get } from '@nestjs/common';
import { DailyStatsService } from './daily-stats.service';

@Controller('daily-stats')
export class DailyStatsController {
  constructor(private readonly dailyStatsService: DailyStatsService) {}

  @Get()
  findAll() {
    return this.dailyStatsService.findAll();
  }
}
```

- [ ] **Step 3: Write `DailyStatsModule` and register it**

`server/src/daily-stats/daily-stats.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { DailyStatsController } from './daily-stats.controller';
import { DailyStatsService } from './daily-stats.service';

@Module({
  controllers: [DailyStatsController],
  providers: [DailyStatsService],
})
export class DailyStatsModule {}
```

`server/src/app.module.ts` — add `DailyStatsModule` to `imports`.

- [ ] **Step 4: Verify with curl**

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/daily-stats | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d), d[0])"
# Expect: 1422 <first record, date as "YYYY-MM-DD">
```

- [ ] **Step 5: Commit**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/src/daily-stats server/src/app.module.ts
git commit -m "feat: DailyStats 목록 조회 API 추가"
```

---

## Definition of Done for this plan

- [x] `GET /campaigns` (with token) → 80 campaigns, dates as `"YYYY-MM-DD"`.
- [x] `POST /campaigns` → creates a row with a `CAMP-XXXXXX` id; validation errors return 400 with `{statusCode,message}`.
- [x] `PATCH /campaigns/:id` → updates status only, dates stay `"YYYY-MM-DD"` (fixed a bug where this route alone returned full ISO datetimes — see Task 2).
- [x] `DELETE /campaigns/:id` → 204, row gone.
- [x] `GET /daily-stats` (with token) → 1,422 rows, dates as `"YYYY-MM-DD"`.
- [x] All of the above 401 without a token (global guard, unchanged from Plan 2).
- [x] `pnpm test` and `pnpm run test:e2e` still pass.
