# NestJS 백엔드 파운데이션 구현 계획

> **에이전트 작업자용:** 이 계획을 태스크 단위로 실행할 때는 superpowers:subagent-driven-development(추천) 또는 superpowers:executing-plans 서브스킬을 사용할 것. 각 스텝은 체크박스(`- [ ]`) 문법으로 추적한다.
>
> **이 프로젝트의 실행 방식은 페어프로그래밍이지, 완전 자동 실행이 아니다.** 사람(4년차 프론트엔드 개발자, NestJS는 처음)이 직접 손으로 코드를 작성하며 NestJS를 배운다. 에이전트의 스텝별 역할은: 개념을 2~3문장으로 설명하고, 그 스텝에 필요한 정확한 코드를 보여주고(사람이 비교/수정할 수 있게, 추측하게 하지 않고), 사람이 직접 작성하고 검증 명령어를 스스로 실행할 때까지 기다리는 것. 사람이 명시적으로 "그냥 해달라"고 요청하지 않는 한 Write/Edit로 사람의 소스 파일을 대신 만들지 말 것. 함께 리뷰(Read)하거나 검증 명령어를 같이 실행하는 건 괜찮음.

**목표:** `json-server`를 실제로 동작하는 로컬 NestJS + PostgreSQL 백엔드로 교체한다: 프로젝트 스캐폴딩, Prisma 스키마, Docker 기반 로컬 Postgres, 그리고 `db.json`의 캠페인 80개 / daily stats 1,422개 / admin 계정 1개를 실제 테이블로 옮기는 시딩 스크립트까지. API 비즈니스 로직(인증, campaigns, daily-stats 라우트)은 아직 없음 — 그건 Plan 2~3.

**아키텍처:** `server/`는 기존 Next.js 앱과 같은 저장소 안에 공존하는 새로운 독립 NestJS 프로젝트다(Nx/Turborepo 없음). 로컬 Postgres는 Docker에서 돌려서 프론트엔드 개발 데이터가 백엔드 실험으로 오염되지 않게 한다. `PrismaService`가 `PrismaClient`를 주입 가능한 Nest 프로바이더로 감싸고, `/health` 엔드포인트로 실제 기능을 만들기 전에 DI 배선과 DB 연결이 end-to-end로 동작하는지 증명한다.

**기술 스택:** NestJS 11, Prisma 7(driver adapter, `prisma.config.ts`, 클라이언트는 `server/generated/prisma`에 생성), `@prisma/adapter-pg`, PostgreSQL 16(Docker), pnpm, Jest(Nest 스캐폴딩에 기본 포함), bcrypt, tsx(시딩 스크립트 실행용).

## 전역 제약사항

- 패키지 매니저는 어디서나 **pnpm** 사용(저장소가 이미 `pnpm-lock.yaml` / `pnpm-workspace.yaml`을 쓰고 있음) — `npm install` / `yarn` 절대 금지.
- 루트 프론트엔드 `tsconfig.json`은 `"strict": true`다 — 새로 만드는 `server/tsconfig.json`(Nest 기본값)도 `strict: true`로 생성되니, 이걸 완화하지 말 것.
- `server/`는 자체 `package.json`/`node_modules`를 가진 별도의 npm 프로젝트이며 pnpm 워크스페이스 멤버가 아니다(`pnpm-workspace.yaml`은 현재 빌드 의존성 예외 목록만 있고 워크스페이스 패키지 목록은 없음) — 의존성 설치는 `cd server && pnpm install`로 할 것, 저장소 루트에서 하지 말 것.
- Prisma enum `CampaignStatus`는 정확히 5개 값을 가져야 함: `active`, `paused`, `ended`, `stopped`, `running`(실제 `db.json`으로 확인: active=31, ended=26, paused=21, stopped=1, running=1 — `running`을 `active`로 뭉개지 않고 실제 상태로 유지하기로 사용자와 결정).
- `db.json`(저장소 루트, `server/`보다 한 단계 위)이 시딩 데이터의 출처다: 캠페인 80개, daily_stats 1,422개. 시딩 스크립트는 `upsert`를 써서 멱등성(재실행해도 안전)을 보장해야 함.
- `db.json`의 `budget`은 타입이 섞여 있음(`int | null | "2000000원"`처럼 `원` 접미사가 붙은 문자열) — Prisma에서는 `Int | null`로 정규화해야 하고, 잘못된 값이 와도 절대 예외를 던지면 안 됨.
- `server/.env`는 절대 커밋하지 말 것(루트 `.gitignore`의 `.env*` 규칙으로 이미 커버됨) — 대신 플레이스홀더 값만 담은 `server/.env.example`을 커밋할 것.
- 이 계획의 범위를 벗어나는 새 기능은 추가하지 말 것(인증, CRUD 라우트는 아직 없음 — 그건 Plan 2/3). 아래 태스크에 없는 건 만들지 말 것.

---

## 사전 준비 (Task 1 전에 할 것)

이 기기에는 아직 Docker가 설치되어 있지 않다. Task 1 전에 Docker Desktop을 설치하고 실제로 실행 중인지(메뉴바의 고래 아이콘) 확인할 것:

```bash
brew install --cask docker
open -a Docker
```

Docker Desktop이 완전히 켜질 때까지 기다린 다음 확인:

```bash
docker --version
docker compose version
```

둘 다 버전 번호가 출력되어야 한다("command not found"가 아니라) — 그래야 다음으로 진행.

---

### Task 1: Docker Compose로 로컬 Postgres

**파일:**
- 생성: `docker-compose.yml` (저장소 루트)

**인터페이스:**
- 산출물: `postgresql://dashboard:dashboard@localhost:5432/marketing_dashboard`로 접속 가능한 Postgres 16 인스턴스. Task 3의 `server/.env`의 `DATABASE_URL`이 이걸 사용함.

- [ ] **Step 1: `docker-compose.yml` 작성**

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

- [ ] **Step 2: 실행**

실행: `docker compose up -d`
기대 결과: `[+] Running 2/2`와 함께 `postgres` 컨테이너가 `Started`/`Healthy`.

- [ ] **Step 3: 연결 확인**

실행: `docker compose exec postgres psql -U dashboard -d marketing_dashboard -c '\dt'`
기대 결과: `Did not find any relations.` (테이블은 비어있지만 연결은 성공 — Prisma가 손대기 전에 자격증명/포트가 맞다는 걸 증명).

- [ ] **Step 4: 커밋**

```bash
git add docker-compose.yml
git commit -m "chore: add local Postgres via Docker Compose"
```

---

### Task 2: NestJS 프로젝트 스캐폴딩

**파일:**
- 생성: `server/` (NestJS CLI가 생성하는 프로젝트 전체)
- 수정: `server/src/main.ts`

**인터페이스:**
- 산출물: 기본적으로 `3001`번 포트에서 리슨하는 실행 가능한 Nest 앱(기존 `json-server`가 쓰던 포트와 동일해서, `shared/constants/api.ts`의 `API_BASE_URL = "http://127.0.0.1:3001"`을 Plan 4에서 바꿀 필요가 없음).

- [ ] **Step 1: 프로젝트 스캐폴딩**

저장소 루트에서 실행:
```bash
npx -y @nestjs/cli@11 new server --package-manager pnpm --skip-git
```
기대 결과: `src/`, `test/`, `package.json`, `nest-cli.json`, `tsconfig.json`이 있는 `server/` 디렉토리가 생성되고, pnpm으로 의존성까지 이미 설치됨.

- [ ] **Step 2: 기본 포트를 3001로**

`server/src/main.ts` 수정 — 생성된 파일은 이렇게 생겼음:
```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```
기본 포트를 `3001`로 변경:
```ts
  await app.listen(process.env.PORT ?? 3001);
```

- [ ] **Step 3: 실행하고 확인**

실행: `cd server && pnpm run start:dev`
기대 결과: 콘솔에 `Nest application successfully started`가 뜨고 3001번 포트에서 리슨.

다른 터미널에서: `curl http://localhost:3001`
기대 결과: `Hello World!`

- [ ] **Step 4: 생성된 테스트 스위트 실행 (뭔가 추가하기 전 정상 동작 확인)**

`server/` 안에서 `pnpm test`(유닛)와 `pnpm run test:e2e`(e2e) 실행
기대 결과: 둘 다 통과(CLI가 생성한 `app.controller.spec.ts` / `app.e2e-spec.ts` 각각 테스트 1개씩).

- [ ] **Step 5: 커밋**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server
git commit -m "feat: scaffold NestJS server project"
```

---

### Task 3: Prisma 스키마 + 마이그레이션

**파일:**
- 생성: `server/prisma/schema.prisma`
- 생성: `server/.env` (커밋 안 함)
- 생성: `server/.env.example`
- 수정: `server/.gitignore` (`.env`가 이미 무시되는지 확인 — Nest 기본 설정에 이미 포함되어 있음)

**인터페이스:**
- 소비: Task 1의 Postgres, `postgresql://dashboard:dashboard@localhost:5432/marketing_dashboard`.
- 산출물: `Admin`, `Campaign`, `DailyStat` 테이블과 `CampaignStatus`/`Platform` enum, `server/prisma/migrations/` 아래 마이그레이션 파일 — Task 4의 `PrismaService`와 Task 6의 `seed.ts`가 사용.

- [ ] **Step 1: Prisma 설치**

`server/` 안에서 실행:
```bash
pnpm add -D prisma dotenv
pnpm add @prisma/client @prisma/adapter-pg
npx prisma init --datasource-provider postgresql
```
기대 결과: `server/prisma/schema.prisma`(기본값), `server/prisma.config.ts`, 플레이스홀더 `DATABASE_URL`이 담긴 `server/.env` 생성. `@prisma/adapter-pg`는 Prisma 7의 PostgreSQL driver adapter다 — Prisma 7이 기존 Rust 쿼리 엔진을 제거해서, 이제 클라이언트가 Postgres와 통신하려면 명시적인 adapter가 필요함.

`pnpm install`이 `[ERR_PNPM_IGNORED_BUILDS]`와 함께 어떤 패키지 이름(예: `@prisma/engines`, `prisma`)을 언급하며 멈추면, 이건 pnpm의 빌드 스크립트 승인 게이트라 Prisma 자체와는 무관함: 해당 패키지를 `server/pnpm-workspace.yaml`의 `allowBuilds`(값을 `true`로)와 `onlyBuiltDependencies` 양쪽에 추가하고 `pnpm install`을 다시 실행할 것.

- [ ] **Step 2: 실제 연결 문자열 설정**

`server/.env` 수정:
```
DATABASE_URL="postgresql://dashboard:dashboard@localhost:5432/marketing_dashboard?schema=public"
```

`server/.env.example`(이건 커밋함) 생성, 플레이스홀더로:
```
DATABASE_URL="postgresql://dashboard:dashboard@localhost:5432/marketing_dashboard?schema=public"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="change-me-before-seeding"
JWT_SECRET="change-me"
JWT_REFRESH_SECRET="change-me"
```
(`ADMIN_EMAIL`/`ADMIN_PASSWORD`는 Task 6에서 사용; `JWT_*`는 Plan 2를 위한 플레이스홀더 — 백엔드에 필요한 모든 환경변수를 `.env.example` 하나로 관리하기 위해 지금 미리 추가해둠.)

- [ ] **Step 3: `server/prisma/schema.prisma`를 실제 스키마로 교체**

Prisma 7은 클라이언트 생성·설정 방식을 바꿨다(사용자 본인의 기존 동작하는 Prisma 7 + NestJS 프로젝트인 `~/Documents/GitHub/nest-core`와 공식 `prisma.io/blog/nestjs-prisma-rest-api` 가이드로 확인): 이제 generator가 순수 TS/JS 클라이언트를 프로젝트 폴더에 생성하고(`node_modules/@prisma/client`가 아니라), datasource URL은 `datasource.url = env(...)` 대신 `prisma.config.ts` + driver adapter로 연결된다.

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
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

`moduleFormat = "cjs"`는 `nest-core`의 스키마엔 없지만 중요하다: 이게 없으면 생성된 클라이언트가 ESM `import`/`export` 문법으로 나오고, Nest의 CommonJS 빌드 위에서 실행하면 `PrismaClient`를 건드리는 순간 `ReferenceError: exports is not defined in ES module scope`가 뜬다. 이 에러를 보면 이게 원인이다 — `moduleFormat = "cjs"`를 설정하고, `server/generated`와 `server/dist`를 지운 뒤 `npx prisma generate`를 다시 실행할 것.

- [ ] **Step 4: 마이그레이션 실행**

`server/` 안에서 실행: `npx prisma migrate dev --name init`
기대 결과: `Your database is now in sync with your schema.`와 함께 새 `server/prisma/migrations/<timestamp>_init/migration.sql` 파일 생성.

- [ ] **Step 5: 테이블 생성 확인**

실행: `docker compose exec postgres psql -U dashboard -d marketing_dashboard -c '\dt'`
기대 결과: `Admin`, `Campaign`, `DailyStat`, `_prisma_migrations`가 나열됨.

- [ ] **Step 6: 커밋**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/prisma server/prisma.config.ts server/.env.example server/.gitignore
git commit -m "feat: add Prisma schema and initial migration"
```

---

### Task 4: PrismaService + health check

**파일:**
- 생성: `server/src/prisma/prisma.service.ts`
- 생성: `server/src/prisma/prisma.module.ts`
- 생성: `server/src/health/health.controller.ts`
- 수정: `server/src/app.module.ts`
- 수정: `server/src/main.ts` (다른 무엇보다 먼저 `.env` 로드)
- 수정: `server/test/jest-e2e.json`, `server/package.json` (Jest/Prisma 7 호환성 — Step 6 참고)

**인터페이스:**
- 소비: `server/generated/prisma/client`에 생성된 `PrismaClient` (Task 3).
- 산출물: `PrismaService`(주입 가능, `server/src/prisma/prisma.service.ts`), `PrismaModule`로 import 가능 — Plan 2의 `AuthModule`과 Plan 3의 `CampaignsModule`/`DailyStatsModule`이 이 동일한 `PrismaService`를 각자의 서비스에 주입해서 쓸 예정.

> **결정 사항:** 검토 후 이 태스크에서는 TDD를 생략했다 — `/health`는 로직이 거의 없는 얇은 엔드포인트(DB 쿼리 날리고 고정된 객체 반환)라서, `server/test/health.e2e-spec.ts`를 먼저 쓰는 대신 바로 구현하고 `curl`로 확인했다. TDD는 Task 5부터 다시 적용하는데, 거기엔 테스트로 몰아붙일 가치가 있는 진짜 로직(순수 함수)이 있다. 그래도 e2e 테스트를 원한다면, Task 2에서 Nest가 생성한 기본 `test/app.e2e-spec.ts`와 같은 모양으로 `GET /health`를 호출해서 `{ status: 'ok' }`인지 확인하면 된다.

- [ ] **Step 1: `PrismaService` 작성**

Prisma 7은 클라이언트 생성자에 driver adapter를 넘겨줘야 한다(`~/Documents/GitHub/nest-core`의 실제 동작하는 `PrismaService`로 확인 — 거긴 MySQL adapter인 `PrismaMariaDb`를 똑같은 방식으로 씀. 우리는 Postgres용 `PrismaPg`를 씀). 생성된 클라이언트 자체는 `server/generated/prisma`에 있고(다음 스텝들에서 `prisma migrate`/`prisma generate`가 만듦, git에는 커밋 안 함), 그래서 import 경로가 `@prisma/client`가 아니라 상대 경로다.

`server/src/prisma/prisma.service.ts`:
```ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 2: `PrismaModule` 작성 (전역으로 — 앞으로 만들 모든 기능 모듈이 재import 없이 `PrismaService`를 주입받을 수 있게)**

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

- [ ] **Step 3: health 컨트롤러 작성**

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

- [ ] **Step 4: 두 모듈을 `AppModule`에 연결**

`server/src/app.module.ts` — import와 controller 추가:
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

- [ ] **Step 5: `main.ts`에서 `.env` 로드**

`prisma.config.ts`는 Prisma CLI(`prisma migrate`, `prisma generate`)를 위해 `.env`를 로드하지만, `nest start`는 `main.ts`를 직접 실행하고 `prisma.config.ts`는 전혀 건드리지 않는다 — 그래서 이걸 안 하면 `PrismaService`의 생성자가 `process.env.DATABASE_URL`을 `undefined`로 읽고, Postgres 인증이 `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`라는 헷갈리는 에러로 실패한다. `server/src/main.ts`의 맨 첫 줄로 import 추가:
```ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
```

- [ ] **Step 6: curl로 수동 확인**

실행: `pnpm run start:dev`, `Nest application successfully started`를 기다린 다음 다른 터미널에서:
```bash
curl -s http://localhost:3001/health
```
기대 결과: `{"status":"ok"}`.

- [ ] **Step 7: `pnpm test` / `pnpm run test:e2e`가 계속 통과하도록 Jest 수정**

`PrismaModule`을 `AppModule`에 추가했다는 건 `AppModule`을 부팅하는 기존 테스트(Task 2의 기본 `test/app.e2e-spec.ts`)가 이제 생성된 Prisma 클라이언트까지 딸려 들어온다는 뜻이고, 이게 Prisma 7에서 Jest를 두 가지 방식으로 깨뜨린다 — 둘 다 우리가 짠 코드와는 무관한, Prisma 7과 Jest 사이의 상호운용성 문제다:

1. 생성된 클라이언트의 `.ts` 파일들이 형제 파일을 `.js` 확장자로 명시해서 import한다(예: `import * as $Class from './internal/class.js'`) — TS의 `nodenext`/`bundler` 해석 방식에선 표준이지만, ts-jest의 기본 CommonJS 해석은 실제로는 없는 `class.js` 파일을 찾다가(`class.ts`만 존재) `Cannot find module './internal/class.js'`로 실패한다.
2. Prisma 7의 클라이언트는 WASM 쿼리 컴파일러를 dynamic `import()`로 지연 로드하는데, Jest는 `--experimental-vm-modules` Node 플래그 없이는 이걸 거부하며 `A dynamic import callback was invoked without --experimental-vm-modules`로 실패한다.

수정 1 — Jest가 상대 경로 import를 해석하기 전에 `.js`를 떼어내는 `moduleNameMapper`를 **두 Jest 설정 모두**에 추가:

`server/test/jest-e2e.json`:
```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "moduleNameMapper": {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  }
}
```

`server/package.json`의 `"jest"` 블록 — 기존 `testEnvironment: "node"` 줄 옆에 동일한 `moduleNameMapper` 키 추가.

수정 2 — `server/package.json`의 테스트 스크립트 앞에 Node 플래그 추가:
```json
    "test": "NODE_OPTIONS=--experimental-vm-modules jest",
    "test:watch": "NODE_OPTIONS=--experimental-vm-modules jest --watch",
    "test:cov": "NODE_OPTIONS=--experimental-vm-modules jest --coverage",
    "test:e2e": "NODE_OPTIONS=--experimental-vm-modules jest --config ./test/jest-e2e.json"
```

실행: `pnpm test`와 `pnpm run test:e2e`
기대 결과: 둘 다 여전히 `1 passed, 1 total`(Task 2 때의 원래 스캐폴딩 테스트) — 이 스텝은 `AppModule`이 Prisma를 끌어들이기 시작한 뒤에도 기존 테스트 스위트를 그린 상태로 유지하는 게 목적이지, 새 테스트를 추가하는 게 아님.

- [ ] **Step 8: 커밋**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/src server/test server/package.json
git commit -m "feat: add PrismaService and /health endpoint"
```

---

### Task 5: budget 정규화 유틸 (TDD)

**파일:**
- 생성: `server/src/prisma/seed-utils.ts`
- 생성: `server/src/prisma/seed-utils.spec.ts`

**인터페이스:**
- 산출물: `normalizeBudget(raw: number | string | null): number | null`, Task 6의 `server/prisma/seed.ts`가 사용.

- [ ] **Step 1: 실패하는 유닛 테스트 작성**

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

- [ ] **Step 2: 실행해서 실패하는지 확인**

실행: `cd server && pnpm test seed-utils`
기대 결과: FAIL — `Cannot find module './seed-utils'`.

- [ ] **Step 3: 구현**

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

- [ ] **Step 4: 실행해서 통과하는지 확인**

실행: `pnpm test seed-utils`
기대 결과: PASS — 4/4 테스트 통과.

- [ ] **Step 5: 커밋**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/src/prisma/seed-utils.ts server/src/prisma/seed-utils.spec.ts
git commit -m "feat: add normalizeBudget seed utility with tests"
```

---

### Task 6: 시딩 스크립트 (db.json → Postgres) + Admin 시딩

**파일:**
- 생성: `server/prisma/seed.ts`
- 수정: `server/package.json` (`prisma.seed` 설정 + `ts-node`/`bcrypt` 의존성 추가)

**인터페이스:**
- 소비: `normalizeBudget`(Task 5), `PrismaClient`(Task 3), 저장소 루트의 `db.json`(`server/`보다 한 단계 위).
- 산출물: 데이터가 채워진 DB — `Campaign` 80행, `DailyStat` 1,422행, `Admin` 1행 — Plan 2(인증)와 Plan 3(campaigns/daily-stats API)가 여기서 읽어감.

- [ ] **Step 1: 시딩용 의존성 설치**

`server/` 안에서 실행:
```bash
pnpm add bcrypt
pnpm add -D @types/bcrypt
```
(시딩 스크립트를 실제로 실행하는 `tsx`는 Task 3에서 Prisma driver adapter와 함께 이미 설치됨.)

- [ ] **Step 2: 시딩 스크립트 실행 방법을 Prisma에게 알려주기**

Prisma 7은 시딩 명령을 `package.json#prisma.seed`가 아니라 `prisma.config.ts`에서 읽는다(이 필드는 이제 무시됨 — Task 2에서 pnpm이 `package.json#pnpm`을 무시하던 것과 같은 얘기). `server/prisma.config.ts`를 수정해서 `migrations` 안에 `seed` 키 추가:
```ts
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
```

- [ ] **Step 3: 시딩 스크립트 작성**

`server/prisma/seed.ts`:
```ts
import 'dotenv/config';
import { PrismaClient, CampaignStatus, Platform } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { normalizeBudget } from '../src/prisma/seed-utils';

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

- [ ] **Step 4: 로컬 개발용 실제 admin 계정 정보 설정**

`server/.env`(커밋 안 됨) 수정, 실제 값으로:
```
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="pick-a-real-local-password"
```

- [ ] **Step 5: 시딩 실행**

`server/` 안에서 실행: `npx prisma db seed`
기대 출력의 끝부분:
```
Seeded 80 campaigns
Seeded 1422 daily stats
Seeded admin: admin@example.com
```

- [ ] **Step 6: Postgres에서 카운트 직접 확인**

실행:
```bash
docker compose exec postgres psql -U dashboard -d marketing_dashboard -c \
  'SELECT (SELECT COUNT(*) FROM "Campaign") AS campaigns, (SELECT COUNT(*) FROM "DailyStat") AS daily_stats, (SELECT COUNT(*) FROM "Admin") AS admins;'
```
기대 결과: `campaigns=80`, `daily_stats=1422`, `admins=1`.

- [ ] **Step 7: 재실행해서 멱등성 확인**

실행: `npx prisma db seed` 한 번 더.
기대 결과: 같은 로그 출력, 중복 키 에러 없음, 카운트 변화 없음(upsert지 insert가 아니므로).

- [ ] **Step 8: 커밋**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/prisma/seed.ts server/prisma.config.ts server/package.json server/pnpm-lock.yaml
git commit -m "feat: add db.json seed script with admin bootstrap"
```

---

### Task 7: ~~프론트엔드 `CampaignStatus` 확장~~ — 제외, 필요 없음

**Task 6 도중에 대체됨.** 이 태스크는 `db.json`의 `stopped`/`running` 상태값(그리고 `네이버`/`facebook`/`Facebook` 같은 지저분한 `platform` 값)이 새로운 프론트엔드 타입을 필요로 한다고 가정했다. 아니다: `shared/utils/dataset.ts`에 이미 `normalizeStatus`(`running`→`active`, `stopped`→`ended`)와 `normalizePlatform`(지저분한 문자열을 키워드 매칭으로 `Google`/`Naver`/`Meta`로 변환)이 있다 — 기존 프론트엔드는 이미 이 정확히 지저분한 데이터를 원래 3개 상태 / 3개 플랫폼으로 뭉개도록 설계돼 있었다. `CampaignStatus`를 확장했다면 이 기존 컨벤션과 충돌했을 거고, `STATUS_CONFIG`에 새로 추가한 `stopped`/`running` 항목은 죽은 코드로 남았을 거다(정규화 이후엔 그 값들을 만들어내는 곳이 없으니까).

Task 6의 시딩 스크립트는 동일한 정규화(`server/src/prisma/seed-utils.ts`의 `normalizeStatus`/`normalizePlatform`/`normalizeNumber`)를 그대로 반영해서, Postgres에는 항상 3개의 정식 상태값과 3개의 정식 플랫폼만 저장된다 — 프론트엔드 변경 불필요. `shared/types/index.ts`의 `CampaignStatus`는 `"active" | "paused" | "ended"`로 그대로 유지.

---

## 이 계획의 완료 기준 (Definition of Done)

- [x] `docker compose ps`에서 `postgres` 컨테이너가 healthy로 표시됨.
- [x] `cd server && pnpm run start:dev`가 에러 없이 부팅됨; `curl http://localhost:3001/health`가 `{"status":"ok"}` 반환.
- [x] `pnpm test`와 `pnpm run test:e2e`(`server/` 안에서) 둘 다 통과.
- [x] Postgres에 캠페인 80개, daily stats 1,422개, admin 1개 존재(`psql` 카운트 쿼리로 확인).
- [x] 프론트엔드는 손대지 않음 — `CampaignStatus`는 3개 값 그대로(Task 7 제외, 위 참고).
- [x] Plan 2(인증)나 Plan 3(campaigns/daily-stats 라우트)에 속한 건 아직 아무것도 없음 — `server/src`엔 `app.*`, `prisma/`, `health/`만 있음.
