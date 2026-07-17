# NestJS Campaigns/DailyStats API 구현 계획

> **에이전트 작업자용:** 이 계획을 태스크 단위로 실행할 때는 superpowers:subagent-driven-development(추천) 또는 superpowers:executing-plans 서브스킬을 사용할 것. 각 스텝은 체크박스(`- [ ]`) 문법으로 추적한다.
>
> **실행 방식: TDD 없이 바로 구현** (Plan 2와 동일) — 구현하고 `curl`로 검증.

**목표:** `GET/POST/PATCH/DELETE /campaigns`와 `GET /daily-stats`를, 기존 프론트엔드의 호출 형태(`fetchCampaigns`, `updateCampaignStatus`, `createCampaign`, `deleteCampaign`, `fetchDailyStats`)와 정확히 맞춰서 만들어, Plan 4에서 시그니처 변경 없이 내부 구현만 바꿔치기할 수 있게 한다.

**아키텍처:** 두 개의 기능 모듈(`CampaignsModule`, `DailyStatsModule`), 각각 `PrismaService`를 주입받는 얇은 컨트롤러+서비스로 구성. Plan 2의 전역 `JwtAuthGuard`로 자동 보호됨 — `@Public()` 필요 없고, 별도 가드 설정도 필요 없음.

**기술 스택:** Plan 1/2와 동일 — Nest 11, Prisma 7, class-validator.

## 전역 제약사항

- DTO 검증은 `features/campaign/schemas/campaignFormSchema.ts` / `shared/constants/campaign.ts`의 `CAMPAIGN_LIMITS`와 정확히 일치해야 함: 이름 2~100자, 예산 100~1,000,000,000(정수), `endDate > startDate`.
- **`cost`는 이 API에 포함되지 않는다.** `useCampaignForm.ts:54-62`를 읽어서 확인함: 폼이 클라이언트 쪽에서 `cost <= budget`을 검증하긴 하지만 `createCampaignAction`에 `cost`를 절대 보내지 않는다 — `shared/types/index.ts`나 `server/prisma/schema.prisma`에도 `Campaign` 필드로 존재하지 않음. 추가하지 말 것.
- `PATCH /campaigns/:id`는 오직 `status`만 바꾼다 — 설계 문서("현재도 status PATCH만 존재하며 그대로 유지")와 다른 캠페인 수정 UI가 없는 기존 프론트엔드와 일치.
- `POST /campaigns` DTO는 `status`도 받아야 함(서버에서 기본값으로 정하지 말 것): `features/campaign/services/api.ts`의 `createCampaign`이 `Omit<Campaign, "id">`를 보내는데, 여기 `status`가 포함됨 — 기존 프론트엔드(`useCampaignForm.ts:59`)는 항상 `"active"`를 보내지만, API 계약이 그걸 전제로 하면 안 됨.
- 응답 날짜: Prisma는 JS `Date` 객체를 반환하지만, 프론트엔드는 순수 `"YYYY-MM-DD"` 문자열을 기대함(예전 `db.json`/json-server 포맷과 일치 — `shared/types/index.ts`의 `startDate: string | null` 참고). 서비스 레이어에서 반환 전에 `startDate`/`endDate`/`date`를 `YYYY-MM-DD`로 포맷할 것, 풀 ISO datetime으로 직렬화되게 두지 말 것.
- 이 계획의 모든 라우트는 기본적으로 보호됨(Plan 2의 전역 `JwtAuthGuard`) — 여기서는 어디에도 `@Public()`을 추가하지 말 것.

---

### Task 1: `CampaignsModule` — `GET /campaigns`, `POST /campaigns`

**파일:**
- 생성: `server/src/campaigns/campaign.constants.ts`
- 생성: `server/src/campaigns/dto/create-campaign.dto.ts`
- 생성: `server/src/campaigns/campaigns.service.ts`
- 생성: `server/src/campaigns/campaigns.controller.ts`
- 생성: `server/src/campaigns/campaigns.module.ts`
- 수정: `server/src/app.module.ts`

**인터페이스:**
- 소비: `PrismaService`(Plan 1).
- 산출물: `CampaignsService.findAll()`, `CampaignsService.create(dto)` — 여기서는 `CampaignsController`가 사용하고, Plan 4에서 프론트엔드 `fetchCampaigns()`/`createCampaign()`의 내부가 이 API를 가리키게 되면 암묵적으로 그쪽에서도 사용됨.

- [ ] **Step 1: 프론트엔드 검증 한도 그대로 반영**

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

- [ ] **Step 2: 생성 DTO 작성**

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

- [ ] **Step 3: `CampaignsService` 작성**

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
`CAMP-XXXXXX` 랜덤 ID 생성은 `features/campaign/services/api.ts:25`의 기존 프론트엔드 `createCampaign`에서 그대로 가져온 것이다 — 데이터가 실제로 위치하는 곳에 맞춰, ID 생성을 클라이언트 쪽에 남겨두는 대신 서버 쪽으로 옮겼다.

- [ ] **Step 4: `CampaignsController` 작성**

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

- [ ] **Step 5: `CampaignsModule` 작성하고 등록**

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

`server/src/app.module.ts` — `imports`에 `CampaignsModule` 추가.

- [ ] **Step 6: curl로 검증**

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"<server/.env의 ADMIN_PASSWORD>"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['accessToken'])")

# 목록 조회 (캠페인 80개, startDate/endDate가 "YYYY-MM-DD" 형태여야 함)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/campaigns | python3 -m json.tool | head -20

# 등록 (CAMP-XXXXXX id를 가진 캠페인 객체가 돌아와야 함)
curl -s -X POST http://localhost:3001/campaigns -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"테스트 캠페인","platform":"Google","status":"active","budget":500000,"startDate":"2026-08-01","endDate":"2026-08-31"}'

# 검증 실패 케이스 (400, {statusCode,message}가 나와야 함)
curl -s -X POST http://localhost:3001/campaigns -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"a","platform":"Google","status":"active","budget":500000,"startDate":"2026-08-01","endDate":"2026-08-31"}'
```

- [ ] **Step 7: 커밋**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/src/campaigns server/src/app.module.ts
git commit -m "feat: Campaigns 목록 조회/등록 API 추가"
```

---

### Task 2: `PATCH /campaigns/:id`(상태), `DELETE /campaigns/:id`

**파일:**
- 생성: `server/src/campaigns/dto/update-campaign-status.dto.ts`
- 수정: `server/src/campaigns/campaigns.service.ts`
- 수정: `server/src/campaigns/campaigns.controller.ts`

**인터페이스:**
- 산출물: `CampaignsService.updateStatus(id, dto)`, `CampaignsService.remove(id)`.

- [ ] **Step 1: 상태 변경 DTO 작성**

`server/src/campaigns/dto/update-campaign-status.dto.ts`:
```ts
import { IsIn } from 'class-validator';

const STATUSES = ['active', 'paused', 'ended'] as const;

export class UpdateCampaignStatusDto {
  @IsIn(STATUSES)
  status: (typeof STATUSES)[number];
}
```

- [ ] **Step 2: `CampaignsService`에 `updateStatus`/`remove` 추가**

`server/src/campaigns/campaigns.service.ts`의 기존 `findAll`/`create` 옆에 추가:
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
import 추가: `import { UpdateCampaignStatusDto } from './dto/update-campaign-status.dto';`

- [ ] **Step 3: `CampaignsController`에 라우트 추가**

`server/src/campaigns/campaigns.controller.ts`에 추가:
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
import 갱신: `@nestjs/common`에서 `Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post`를 가져오고, `import { UpdateCampaignStatusDto } from './dto/update-campaign-status.dto';` 추가.

- [ ] **Step 4: curl로 검증**

```bash
# 먼저 목록에서 실제 캠페인 id 하나 가져오기
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/campaigns | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])"

# 상태 PATCH
curl -s -X PATCH http://localhost:3001/campaigns/<id> -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"paused"}'
# status가 "paused"로 바뀐 캠페인이 돌아와야 함

# Task 1에서 만든 테스트 캠페인 삭제 (CAMP-XXXXXX id 사용)
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:3001/campaigns/<CAMP-XXXXXX> -H "Authorization: Bearer $TOKEN"
# 204가 나와야 함
```

- [ ] **Step 5: 커밋**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/src/campaigns
git commit -m "feat: Campaigns 상태 변경/삭제 API 추가"
```

---

### Task 3: `DailyStatsModule` — `GET /daily-stats`

**파일:**
- 생성: `server/src/daily-stats/daily-stats.service.ts`
- 생성: `server/src/daily-stats/daily-stats.controller.ts`
- 생성: `server/src/daily-stats/daily-stats.module.ts`
- 수정: `server/src/app.module.ts`

**인터페이스:**
- 소비: `PrismaService`.
- 산출물: `GET /daily-stats`, `features/dashboard/services/api.ts`의 `fetchDailyStats()`와 대응.

- [ ] **Step 1: `DailyStatsService` 작성**

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

- [ ] **Step 2: `DailyStatsController` 작성**

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

- [ ] **Step 3: `DailyStatsModule` 작성하고 등록**

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

`server/src/app.module.ts` — `imports`에 `DailyStatsModule` 추가.

- [ ] **Step 4: curl로 검증**

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/daily-stats | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d), d[0])"
# 기대 결과: 1422 <첫 레코드, date는 "YYYY-MM-DD" 형태>
```

- [ ] **Step 5: 커밋**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/src/daily-stats server/src/app.module.ts
git commit -m "feat: DailyStats 목록 조회 API 추가"
```

---

## 이 계획의 완료 기준 (Definition of Done)

- [x] `GET /campaigns`(토큰 있음) → 캠페인 80개, 날짜는 `"YYYY-MM-DD"`.
- [x] `POST /campaigns` → `CAMP-XXXXXX` id를 가진 행 생성; 검증 에러는 `{statusCode,message}` 형태로 400.
- [x] `PATCH /campaigns/:id` → status만 변경, 날짜는 계속 `"YYYY-MM-DD"`(이 라우트만 풀 ISO datetime을 반환하던 버그를 고침 — Task 2 참고).
- [x] `DELETE /campaigns/:id` → 204, 행 삭제됨.
- [x] `GET /daily-stats`(토큰 있음) → 1,422행, 날짜는 `"YYYY-MM-DD"`.
- [x] 위 전부 토큰 없으면 401(전역 가드, Plan 2와 동일).
- [x] `pnpm test`와 `pnpm run test:e2e` 여전히 통과.
