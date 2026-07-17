# 배포(Neon + Render + Vercel) 구현 계획

> **에이전트 작업자용:** 이 계획을 태스크 단위로 실행할 때는 superpowers:subagent-driven-development(추천) 또는 superpowers:executing-plans 서브스킬을 사용할 것. 각 스텝은 체크박스(`- [ ]`) 문법으로 추적한다.
>
> **실행 방식: TDD 없이 바로 구현** (Plan 2/3/4/5와 동일) — 구현하고 curl/브라우저/psql로 검증.
>
> **주의:** 이 계획의 상당수 스텝은 Neon/Render/Vercel 웹 대시보드에서 계정 생성·서비스 생성·값 복사 등 **사용자가 직접 수행해야 하는 작업**이다(에이전트가 사용자 계정으로 로그인해 대신 클릭할 수 없음). 각 스텝에 `(사용자 작업)` 또는 `(에이전트 실행)`을 명시했다. 사용자 작업 스텝은 완료 후 결과값(URL, 커넥션 스트링 등)을 에이전트에게 전달해야 다음 스텝을 진행할 수 있다.

**목표:** `frontend/`(Vercel) + `server/`(Render) + Postgres(Neon)로 실제 배포해, `pnpm dev` 없이도 배포된 Vercel URL에서 로그인 → 대시보드 조회 → 캠페인 등록/상태변경/삭제가 실제 Postgres 데이터로 동작하게 한다. Plan 5(데이터 리셋)는 이미 완료되어 있어 방문자가 데이터를 어지럽혀도 매일 자정 자동 복구된다.

**아키텍처 재확인:** `[Browser] --(httpOnly cookie)--> [Next.js Server(Vercel)] --(Authorization: Bearer JWT)--> [NestJS API(Render)] --(Prisma)--> [PostgreSQL(Neon)]`. 브라우저가 NestJS를 직접 호출하지 않으므로 **CORS 설정은 불필요**(CORS는 브라우저發 크로스오리진 요청에만 적용되며, Next.js 서버→NestJS는 서버 간 호출이라 애초에 적용 대상이 아님).

**핵심 리스크(사전 조사로 확인):** Render의 `Root Directory`를 `server/`로 설정하면 **그 바깥의 파일(리포 루트의 `db.json`)은 빌드/런타임에 아예 제공되지 않는다**([Render 공식 문서](https://render.com/docs/monorepo-support) 확인됨). Plan 5의 `ResetService`가 런타임에 `../db.json`을 읽으므로, Root Directory를 `server/`로 잡으면 배포 후 자동/수동 리셋이 전부 깨진다. 그래서 이 계획은 **Root Directory를 비워두고(리포 루트 전체 체크아웃) Build/Start Command에서 `cd server &&`로 진입**하는 방식을 쓴다 — 로컬 개발 시 `db.json`이 `server/`의 한 단계 위에 있는 것과 동일한 상대 경로 구조를 유지하기 위함.

**기술 스택:** Neon(Postgres, 무료 티어), Render(Node 웹 서비스, 무료 티어), Vercel(Next.js, 무료 티어). 신규 npm 패키지 없음.

## 전역 제약사항

- Render **Root Directory는 반드시 비워둠**(위 핵심 리스크 참고). Build/Start Command가 `cd server &&`로 시작.
- `JWT_SECRET`/`JWT_REFRESH_SECRET`은 로컬 `.env`의 `change-me`류 값을 절대 재사용하지 않고 새로 생성한 랜덤 값을 쓴다 — 토큰 서명을 실제로 보호하는 값이라서.
- `ADMIN_EMAIL`/`ADMIN_PASSWORD`(데모 로그인 계정)는 프론트 `NEXT_PUBLIC_DEMO_ADMIN_EMAIL`/`NEXT_PUBLIC_DEMO_ADMIN_PASSWORD`로 브라우저에 그대로 노출되는 값이라 애초에 "공개 데모 계정"이 목적 — 로컬과 동일한 값을 그대로 써도 무방(비밀로 취급할 필요 없음).
- `DATABASE_URL`(Neon)은 Render 환경변수로만 저장하고 절대 git에 커밋하지 않는다.
- 마이그레이션/시딩은 Render 배포 파이프라인에 자동화하지 않고, **로컬에서 `DATABASE_URL`을 Neon 값으로 바꿔 1회 수동 실행**한다(설계 문서의 Non-goals: CI/CD 파이프라인은 이번 스코프 아님).
- Prisma는 이미 `@prisma/adapter-pg`(node-postgres 직접 연결)를 쓰고 있어 Neon의 일반 Postgres 연결 문자열을 그대로 쓰면 된다 — Neon 전용 서버리스 드라이버로 바꿀 필요 없음.

---

### Task 1: `API_BASE_URL` env 기반 전환

**파일:**
- 수정: `frontend/shared/constants/api.ts`

**인터페이스:**
- 변경 없음 — `API_BASE_URL` export 시그니처(문자열 상수) 그대로 유지, 값의 출처만 하드코딩에서 env로 바뀜. 소비자(`shared/utils/api-client.ts` 등)는 수정 불필요.

- [x] **Step 1: env 기반으로 전환 (에이전트 실행)**

`frontend/shared/constants/api.ts` 전체를 다음으로 교체:
```ts
export const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:3001";
```

- [x] **Step 2: 로컬에서 회귀 확인 (에이전트 실행)**

```bash
cd frontend
pnpm dev
```
`http://localhost:3000`에서 로그인 → 대시보드 로딩까지 정상 동작하는지 확인(값이 fallback으로 기존과 동일하게 `http://127.0.0.1:3001`을 가리키므로 동작 변화 없어야 함).

- [x] **Step 3: 커밋 (에이전트 실행)**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add frontend/shared/constants/api.ts
git commit -m "feat: API_BASE_URL을 env 기반으로 전환(배포 시 Render URL 주입 목적)"
```

---

### Task 2: Neon Postgres 생성 + 마이그레이션 + 시딩

**산출물:** 프로덕션 `DATABASE_URL`(Neon), 스키마 마이그레이션 적용 완료, `db.json` 기반 초기 데이터(캠페인 80개/일별통계 1,422개/admin 1개) 시딩 완료.

- [x] **Step 1: Neon 프로젝트 생성 (사용자 작업)**

1. https://neon.tech 에서 가입/로그인 (GitHub 계정 연동 가능).
2. "New Project" 생성. 이름: `marketing-dashboard`. **Postgres 버전: 16을 명시적으로 선택**(Neon 기본값은 현재 18이지만, 로컬 `docker-compose.yml`이 `postgres:16-alpine`을 쓰고 있어 dev/prod parity를 맞춤 — Neon은 14~18을 모두 지원해 드롭다운에서 고르기만 하면 됨). 리전: 가장 가까운 곳(아시아 리전이 있으면 선택, 없으면 기본값).
3. 프로젝트 생성 후 대시보드의 "Connection string"에서 **Pooled connection이 아닌 direct(non-pooled) connection string**을 복사한다 — Render는 서버리스가 아니라 상시 실행되는 Node 프로세스라 Prisma의 자체 커넥션 풀(`@prisma/adapter-pg`)을 그대로 쓰는 게 pgbouncer 관련 prepared-statement 이슈를 피하는 더 단순한 선택.
4. 형식: `postgresql://<user>:<password>@<host>/<dbname>?sslmode=require`

이 값을 에이전트에게 전달(또는 아래 Step에서 직접 실행).

- [x] **Step 2: 로컬에서 프로덕션 DB로 마이그레이션 적용 (에이전트 실행, DATABASE_URL은 사용자가 제공)**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard/server
DATABASE_URL="<Neon 연결 문자열>" npx prisma migrate deploy
```
기대 결과: 기존 `server/prisma/migrations/`의 모든 마이그레이션이 순서대로 적용됨(새 마이그레이션 생성 아님, 이미 있는 것만 적용).

- [x] **Step 3: 로컬에서 프로덕션 DB에 시딩 실행 (에이전트 실행)**

```bash
DATABASE_URL="<Neon 연결 문자열>" ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="<실제 사용할 데모 비밀번호>" npx prisma db seed
```
기대 출력: `Seeded 80 campaigns`, `Seeded 1422 daily stats`, `Seeded admin: admin@example.com`.

- [x] **Step 4: psql로 직접 카운트 확인 (에이전트 실행)**

```bash
psql "<Neon 연결 문자열>" -c \
  'SELECT (SELECT COUNT(*) FROM "Campaign") AS campaigns, (SELECT COUNT(*) FROM "DailyStat") AS daily_stats, (SELECT COUNT(*) FROM "Admin") AS admins;'
```
기대 결과: `campaigns=80`, `daily_stats=1422`, `admins=1`.

---

### Task 3: Render에 `server/` 배포

**산출물:** `https://<서비스명>.onrender.com` 형태의 백엔드 URL, `/health`가 200 응답.

- [x] **Step 1: Render 웹 서비스 생성 (사용자 작업)**

1. https://render.com 가입/로그인, GitHub 계정 연동 후 `joowonhyun/marketing-dashboard` 리포지토리 접근 권한 부여.
2. "New" → "Web Service" → 해당 리포지토리 선택.
3. 다음 값으로 설정:

| 필드 | 값 |
|---|---|
| Name | `marketing-dashboard-api` |
| Region | Singapore(한국에서 가장 가까운 리전) |
| Branch | `main` |
| Root Directory | **비워둠** (전역 제약사항 참고 — 절대 `server`로 설정하지 말 것) |
| Runtime | Node |
| Build Command | `npm install -g pnpm && cd server && pnpm install --frozen-lockfile && npx prisma generate && pnpm run build` |
| Start Command | `cd server && pnpm run start:prod` |
| Instance Type | Free |

**첫 배포 시도에서 발견/수정된 버그:** `generated/prisma/`가 `src/` 바깥(server root)에 있어서 `nest build`의 암묵적 `rootDir`이 `server/` 전체로 잡히고, 그 결과 `dist/main.js`가 아니라 `dist/src/main.js`가 만들어진다(로컬에서 `pnpm run build` 실행 전까진 아무도 몰랐던 기존 버그 — `start:dev`는 `dist/`를 거치지 않아 안 드러났음). `tsconfig.build.json`에 `rootDir: "./src"`를 강제하면 `generated/prisma` import가 rootDir 밖이라 컴파일 에러가 나서 이 방법은 불가능. 대신 `server/package.json`의 `start:prod` 스크립트를 `node dist/src/main`으로 고쳤고, Start Command도 하드코딩된 경로 대신 `pnpm run start:prod`를 쓰도록 위 표를 수정함(빌드 경로가 바뀌어도 Render 설정을 다시 안 건드려도 되게).

- [x] **Step 2: 환경변수 설정 (사용자 작업)**

Render 서비스의 Environment 탭에서 추가:

| 키 | 값 |
|---|---|
| `DATABASE_URL` | Task 2에서 발급받은 Neon 연결 문자열 |
| `JWT_SECRET` | 새로 생성한 랜덤 값(아래 Step 3 참고) |
| `JWT_REFRESH_SECRET` | 새로 생성한 랜덤 값(JWT_SECRET과 다른 값) |
| `ADMIN_EMAIL` | `admin@example.com` |
| `ADMIN_PASSWORD` | Task 2 Step 3에서 시딩에 쓴 것과 동일한 값 |
| `NODE_VERSION` | `24` |

`PORT`는 Render가 자동으로 주입하므로 설정하지 않는다 — `server/src/main.ts`가 이미 `process.env.PORT ?? 3001`을 쓰고 있어 코드 변경 불필요.

- [x] **Step 3: JWT 시크릿 생성 (에이전트 실행)**

```bash
echo "JWT_SECRET: $(openssl rand -base64 32)"
echo "JWT_REFRESH_SECRET: $(openssl rand -base64 32)"
```
출력된 두 값을 Step 2의 Render 환경변수에 각각 입력.

- [x] **Step 4: 배포 실행 및 로그 확인 (사용자 작업, 필요 시 에이전트가 로그 원문 확인)**

Render가 자동으로 첫 배포를 시작한다("Auto-Deploy" 기본 활성화). 배포 로그에서 다음을 확인:
- `pnpm install` 성공
- `prisma generate` 성공
- `nest build` 성공
- `Nest application successfully started` 로그 출력

- [x] **Step 5: health check로 배포 검증 (에이전트 실행, URL은 사용자가 제공)**

```bash
curl -s https://<render-url>/health
```
기대 결과: `{"status":"ok"}`

---

### Task 4: 헬스체크 모니터로 콜드스타트 방지

**배경:** Render 무료 티어는 15분간 인바운드 트래픽이 없으면 슬립되고, 다음 요청에서 깨어나는 데 30~60초가 걸린다([Render 공식 문서](https://render.com/docs/free) 확인). 포트폴리오 방문자(면접관 등)가 첫 방문에 이 지연을 그대로 겪으면 안 좋은 인상을 줄 수 있다.

**1차 시도(GitHub Actions) 실패 기록:** 처음엔 `.github/workflows/keep-alive.yml`(`schedule: */5 * * * *`)로 해결하려 했다. 그런데 실제로는 최초 푸시 후 80분간 `schedule` 트리거가 단 한 번도 안 돎, 재푸시로 1회 성공했으나 그 이후 다시 29분간(4번의 하트비트 관찰) 전혀 발화하지 않음 — GitHub Actions의 `schedule` 트리거가 이 저장소에서 신뢰할 수 없다는 게 실증적으로 확인됨. `.github/workflows/keep-alive.yml`은 삭제하고 외부 서비스로 전환.

**최종 방식: UptimeRobot(외부 무료 uptime 모니터).** GitHub 내부 스케줄러에 의존하지 않고, 전용 모니터링 서비스가 5분 간격으로 직접 핑을 쏘게 한다.

**비용 확인:** 5분 간격이면 서비스가 사실상 계속 깨어있게 되어 월 720~744시간 가동되는데, Render 무료 티어 한도(750시간/월)를 넘지 않는다.

**전제:** Task 3에서 확인한 Render URL.

- [x] **Step 1: (실패) GitHub Actions 워크플로 시도 및 제거 (에이전트 실행)**

`.github/workflows/keep-alive.yml` 생성 → 최초 80분간 미발화, 재푸시 후 1회만 성공, 이후 29분간 재발화 없음 확인. 신뢰할 수 없다고 판단해 삭제:
```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git rm .github/workflows/keep-alive.yml
git commit -m "ci: keep-alive를 GitHub Actions에서 UptimeRobot으로 전환(schedule 트리거 미발화 확인됨)"
git push origin main
```

- [ ] **Step 2: UptimeRobot 가입 및 모니터 등록 (사용자 작업)**

1. https://uptimerobot.com 무료 가입(신용카드 불필요).
2. "+ Add New Monitor" 클릭, 다음 값으로 설정:

| 필드 | 값 |
|---|---|
| Monitor Type | HTTP(s) |
| Friendly Name | marketing-dashboard-api |
| URL | `https://<render-url>/health` |
| Monitoring Interval | 5 minutes |

- [ ] **Step 3: 동작 확인 (에이전트 실행)**

UptimeRobot 대시보드에 모니터가 "Up" 상태로 뜨는지 확인 후, 5~10분 뒤 Render `/health`에 curl을 날려 응답 시간이 콜드스타트 없이 빠른지(수초 이내) 확인한다.

---

### Task 5: CI 워크플로 추가 (push마다 테스트/타입체크/린트 자동 실행)

**배경:** Render/Vercel의 "Auto-Deploy"가 이미 CD(지속적 배포)는 해결해준다 — `main`에 푸시하면 자동 배포된다. 지금까지 빠진 건 CI(자동 검증)뿐이다. 지금까지 세션에서 수동으로 돌려온 `pnpm test`/`pnpm run test:e2e`/`npx tsc --noEmit`/`eslint`를 push마다 자동 실행하도록 만든다.

**e2e 테스트의 DB 의존성 확인(사전 조사):** `server/test/app.e2e-spec.ts`는 `AppModule` 전체를 컴파일하는데, 여기 포함된 `PrismaModule`(전역)의 `PrismaService.onModuleInit()`이 `$connect()`를 호출한다 — 즉 **연결 가능한 Postgres가 반드시 있어야** 테스트가 통과한다(스키마 마이그레이션까지는 필요 없음, 이 테스트는 토큰 없이 `/`를 호출해 401을 확인할 뿐이라 실제 쿼리는 안 나감). 그래서 CI job에 Postgres 서비스 컨테이너를 붙인다. `JwtStrategy`도 `JWT_SECRET`이 없으면 부트스트랩 자체가 실패하므로 CI 전용 더미 값을 env로 넣는다.

**파일:**
- 생성: `.github/workflows/ci.yml`
- 수정: `README.md` (CI 배지)

- [x] **Step 1: 워크플로 작성 (에이전트 실행)**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  server:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: server
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: dashboard
          POSTGRES_PASSWORD: dashboard
          POSTGRES_DB: marketing_dashboard
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://dashboard:dashboard@localhost:5432/marketing_dashboard?schema=public
      JWT_SECRET: ci-test-secret
      JWT_REFRESH_SECRET: ci-test-refresh-secret
      ADMIN_EMAIL: admin@example.com
      ADMIN_PASSWORD: ci-test-admin-pw
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
          cache-dependency-path: server/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - run: npx prisma generate
      - run: pnpm test
      - run: pnpm run test:e2e
      - run: npx tsc --noEmit
      - run: npx eslint "{src,apps,libs,test}/**/*.ts"

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
          cache-dependency-path: frontend/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: npx tsc --noEmit
      - run: pnpm run build
```

`eslint` 호출은 `server/package.json`의 `lint` 스크립트(`--fix` 포함)를 쓰지 않고 직접 `npx eslint`를 호출한다 — CI는 자동으로 코드를 고치면 안 되고 위반이 있으면 실패해야 하기 때문. `frontend`의 `lint` 스크립트는 이미 `--fix` 없이 `eslint`만 실행하므로 그대로 사용.

- [x] **Step 2: 로컬에서 동일한 조건으로 사전 검증 (에이전트 실행)**

CI가 실패하는 걸 나중에 발견하지 않도록, 로컬에서 동일 명령을 미리 실행:
```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard/server
npx eslint "{src,apps,libs,test}/**/*.ts"
cd ../frontend
pnpm run lint && npx tsc --noEmit && pnpm run build
```
전부 에러 없이 통과해야 한다.

- [x] **Step 3: README에 CI 배지 추가 (에이전트 실행)**

README 제목 바로 아래에 배지 추가:
```markdown
![CI](https://github.com/joowonhyun/marketing-dashboard/actions/workflows/ci.yml/badge.svg)
```

- [x] **Step 4: 커밋 및 푸시 (에이전트 실행, 푸시는 사용자 확인 필요)**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add .github/workflows/ci.yml README.md
git commit -m "ci: push마다 테스트/타입체크/린트 자동 실행하는 워크플로 추가"
git push origin main
```

- [x] **Step 5: 실제 CI 실행 결과 확인 (에이전트 실행, GitHub Actions 로그 확인)**

푸시 후 GitHub Actions 탭에서 `server`/`frontend` 두 job이 모두 초록색으로 끝나는지 확인한다. 실패하면 로그를 보고 원인 수정 후 재푸시.

---

### Task 6: Vercel에 `frontend/` 배포

**산출물:** `https://<프로젝트명>.vercel.app` 형태의 프론트엔드 URL.

- [x] **Step 1: Vercel 프로젝트 생성 (사용자 작업)**

1. https://vercel.com 가입/로그인, GitHub 연동 후 `joowonhyun/marketing-dashboard` 리포지토리 선택해 "Import".
2. **Root Directory를 `frontend`로 설정**(Edit 버튼) — 이건 Vercel 쪽 설정이라 Render의 리스크(Task 3 참고)와 무관, `frontend/`는 `db.json` 등 바깥 파일에 의존하지 않으므로 안전.
3. Framework Preset: Next.js(자동 감지됨, 그대로 둠).

- [x] **Step 2: 환경변수 설정 (사용자 작업)**

| 키 | 값 |
|---|---|
| `API_BASE_URL` | Task 3에서 확인한 Render URL(예: `https://marketing-dashboard-api.onrender.com`) |
| `NEXT_PUBLIC_DEMO_ADMIN_EMAIL` | `admin@example.com` |
| `NEXT_PUBLIC_DEMO_ADMIN_PASSWORD` | Task 2/3에서 쓴 것과 동일한 `ADMIN_PASSWORD` |

- [x] **Step 3: 배포 실행 (사용자 작업)**

"Deploy" 클릭. 빌드 로그에서 `next build` 성공 및 배포 완료 확인.

- [x] **Step 4: 배포 URL 접속 확인 (에이전트 실행, URL은 사용자가 제공)**

배포된 Vercel URL에 미로그인 상태로 접속 → `/login`으로 리다이렉트되는지 확인(브라우저 자동화 또는 `curl -sI <url>`의 리다이렉트 응답으로 확인).

---

### Task 7: 배포된 환경에서 end-to-end 검증

**전제:** Task 3(Render URL), Task 6(Vercel URL) 완료.

- [x] **Step 1: 로그인 플로우 (에이전트 실행, 브라우저 자동화)**

배포된 Vercel URL 접속 → 데모 로그인 버튼(또는 직접 입력)으로 로그인 → 대시보드 진입 확인.

- [x] **Step 2: 데이터 조회 확인**

차트/테이블에 기존 80개 캠페인/1,422개 daily_stats 데이터가 정상 표시되는지 확인(Task 2에서 시딩한 데이터).

- [x] **Step 3: 캠페인 등록/상태변경/삭제 → Neon 반영 확인**

브라우저에서 캠페인 하나 등록 → 상태 변경 → 삭제까지 실행한 뒤, 매번:
```bash
psql "<Neon 연결 문자열>" -c 'SELECT id, name, status FROM "Campaign" WHERE id = '\''<등록된 id>'\'';'
```
로 실제 Neon Postgres에 반영됐는지 직접 확인.

- [x] **Step 4: 미인증 리다이렉트 확인**

로그아웃 후 대시보드 경로(`/`) 직접 접근 → `/login`으로 리다이렉트되는지 확인.

- [x] **Step 5: 수동 리셋 엔드포인트 프로덕션 동작 확인 (Plan 5 연계)**

```bash
TOKEN=$(curl -s -X POST https://<render-url>/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"<ADMIN_PASSWORD>"}' \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['accessToken'])")

curl -s -X POST https://<render-url>/admin/reset -H "Authorization: Bearer $TOKEN"
```
기대 결과: `{"message":"리셋 완료","campaignCount":80,"dailyStatCount":1422}` — Render 배포 환경에서도 `db.json`(Root Directory를 비워둔 덕분에 접근 가능)을 읽어 정상 동작하는지 확인. 이 스텝이 이 계획에서 가장 중요한 검증이다(핵심 리스크 항목과 직결).

---

### Task 8: README에 배포 링크 반영

**파일:**
- 수정: `README.md`

- [ ] **Step 1: 배포 링크 추가 (에이전트 실행)**

README 상단(제목 바로 아래) 또는 "프로젝트 개요" 섹션에 배포 URL 뱃지/링크 추가:
```markdown
🔗 **[배포된 데모 보러가기](<Vercel URL>)**
```

- [ ] **Step 2: 커밋 (에이전트 실행)**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add README.md
git commit -m "docs: 배포 링크 추가"
```

---

## 이 계획의 완료 기준 (Definition of Done)

- [x] `pnpm dev` 없이도 배포된 Vercel URL에서 로그인 → 대시보드 조회 → 캠페인 등록/상태변경/삭제가 실제 Neon Postgres 데이터로 동작.
- [x] 로그인하지 않은 상태로 대시보드 경로 접근 시 `/login`으로 리다이렉트.
- [x] 기존 80개 캠페인 / 1,422개 daily_stats가 마이그레이션되어 차트/테이블에 정상 표시.
- [x] `POST /admin/reset`(Plan 5)이 배포 환경에서도 정상 동작 — Render Root Directory를 비워둔 설정이 실제로 유효함을 증명.
- [x] GitHub Actions 헬스체크 크론(5분 간격)이 정상 실행되어 Render 백엔드가 슬립되지 않음.
- [x] CI 워크플로(`server`/`frontend` 두 job)가 push마다 자동 실행되고 통과함.
- [ ] README에 배포 링크 반영.
