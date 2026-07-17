# Next.js BFF 연동(로그인/토큰 갱신) 구현 계획

> **에이전트 작업자용:** 이 계획을 태스크 단위로 실행할 때는 superpowers:subagent-driven-development(추천) 또는 superpowers:executing-plans 서브스킬을 사용할 것. 각 스텝은 체크박스(`- [ ]`) 문법으로 추적한다.
>
> **실행 방식: TDD 없이 바로 구현** (Plan 2/3과 동일) — 구현하고 브라우저/curl로 검증.

**목표:** Next.js가 NestJS API의 유일한 클라이언트가 되는 BFF 패턴 완성 — 로그인 페이지, 라우트 보호 미들웨어, httpOnly 쿠키 기반 토큰 저장, 세션 중 만료 시 자동 갱신. 기존 프론트 함수(`fetchCampaigns`, `updateCampaignStatus`, `createCampaign`, `deleteCampaign`, `fetchDailyStats`)는 시그니처를 유지한 채 내부 구현만 교체한다.

**아키텍처 근거(`~/Documents/GitHub/next-auth-boilerplate`의 `AUTH.md` 검토 결과):** 그 보일러플레이트는 클라이언트 컴포넌트의 직접 fetch까지 지원하는 범용 구조라 `middleware`(페이지 진입 시 갱신) + `serverApi`(RSC용, 갱신 로직 없음) + `proxy`(클라이언트 fetch를 서버로 우회) + `clientApi`(세션 중 만료 시 single-flight 갱신) 4개 레이어로 나뉜다. marketing-dashboard는 설계 문서 단계부터 **클라이언트 컴포넌트가 직접 fetch하는 곳이 전혀 없음**(RSC + Server Action만 사용)을 확인했으므로, `proxy`와 `clientApi`는 필요 없다. 가져올 건 두 가지뿐:
- `middleware`: 페이지 진입 시 accessToken 없고 refreshToken 있으면 갱신 — 그대로 적용.
- `serverApi`(갱신 없음, RSC 전용) + `authUtils.getAccessToken()`(갱신 가능, 쿠키 쓰기 가능한 컨텍스트 전용) — RSC는 쿠키를 못 쓰지만(Next.js 제약) Server Action은 쓸 수 있다는 차이를 그대로 반영해서, `fetchCampaigns`/`fetchDailyStats`(RSC에서 호출)는 갱신 없이 읽기만, `updateCampaignStatus`/`createCampaign`/`deleteCampaign`(Server Action에서 호출)는 401 시 갱신 후 1회 재시도하도록 나눈다.

**백엔드 계약 차이(보일러플레이트 대비 조정 필요):**
- 필드명: 보일러플레이트는 `access_token`(snake_case), 우리 NestJS는 `accessToken`/`refreshToken`(camelCase, Plan 2에서 확정).
- refresh 트리거 상태코드: 보일러플레이트 백엔드는 403을 "만료" 전용 신호로 씀. 우리 `JwtAuthGuard`는 Passport 기본 동작이라 만료든 누락이든 전부 401(Plan 2에서 curl로 확인함) — 그래서 갱신 재시도는 401 기준으로 구현.
- refreshToken 저장 방식: 보일러플레이트는 백엔드가 로그인 시 refresh 쿠키를 직접 `Set-Cookie`하고 Next.js는 accessToken만 쿠키로 씀. 우리 백엔드는 `POST /auth/login`이 accessToken+refreshToken을 **둘 다 JSON 바디로만** 반환(Set-Cookie 없음, 설계 문서 명시) — 그래서 Next.js 쪽에서 로그인 시 두 쿠키를 **둘 다** 직접 set 해야 함.
- 에러 응답 형태: 보일러플레이트는 `{message,status,code,timestamp,errors}`, 우리는 Plan 2의 전역 예외 필터가 만드는 `{statusCode,message}` — 파싱 로직을 단순화.

**기술 스택:** Next.js 16(App Router), `next/headers`의 `cookies()`, Edge `middleware.ts`. 새 npm 패키지는 필요 없음.

## 전역 제약사항

- 토큰은 모두 httpOnly 쿠키(`accessToken` 15분, `refreshToken` 7일) — JS에서 절대 읽지 않음. `secure`는 `process.env.NODE_ENV === "production"`일 때만 true(로컬 http 개발 환경 고려).
- 기존 함수 시그니처(`fetchCampaigns(): Promise<Campaign[]>` 등) 절대 변경 금지 — 호출부(`app/@charts/page.tsx`, `app/@table/page.tsx`, `features/campaign/services/actions.ts`)는 이번 계획에서 손대지 않는다.
- `API_BASE_URL`은 이미 `http://127.0.0.1:3001`로 NestJS 서버와 일치(Plan 1에서 이미 맞춰둠) — 바꿀 필요 없음.
- `/login`만 공개 라우트, 나머지 전부 보호 대상(설계 문서: "미들웨어가 요청마다 쿠키 존재 여부를 검사 — 없으면 /login으로 리다이렉트, /login 자체는 예외").
- RSC(Server Component)는 쿠키를 쓸 수 없다(Next.js 자체 제약) — `fetchCampaigns`/`fetchDailyStats`에는 갱신-후-재시도 로직을 넣지 말 것. 그 책임은 미들웨어가 진다.
- 이번 계획 범위 밖: 회원가입, 소셜 로그인, refresh token rotation(Plan 2에서 이미 최소 구현으로 결정됨).

---

### Task 1: 쿠키 상수 + `api-client.ts` (serverFetch / actionFetch)

**파일:**
- 생성: `shared/constants/auth.ts`
- 생성: `shared/utils/api-client.ts`

**인터페이스:**
- 산출물: `serverFetch<T>(path, options?): Promise<T>`(RSC용, 갱신 없음), `actionFetch<T>(path, options?): Promise<T>`(Server Action용, 401 시 갱신 후 1회 재시도) — Task 2에서 기존 서비스 함수들의 내부 구현이 이걸 사용.

- [ ] **Step 1: 쿠키 상수**

`shared/constants/auth.ts`:
```ts
export const ACCESS_TOKEN_COOKIE = "accessToken";
export const REFRESH_TOKEN_COOKIE = "refreshToken";
export const ACCESS_TOKEN_MAX_AGE = 60 * 15; // 15분
export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7일
```

- [ ] **Step 2: `api-client.ts` 작성**

`shared/utils/api-client.ts`:
```ts
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/shared/constants/api";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_COOKIE,
} from "@/shared/constants/auth";

type ApiErrorBody = { statusCode: number; message: string | string[] };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const parseBody = async (res: Response) => {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
};

const throwIfError = async (res: Response) => {
  if (res.ok) return;
  const body = (await parseBody(res)) as ApiErrorBody | null;
  const message = Array.isArray(body?.message)
    ? body.message.join(", ")
    : (body?.message ?? `요청 실패 (${res.status})`);
  throw new ApiError(res.status, message);
};

const buildRequest = (path: string, token: string | null, options?: RequestInit): [string, RequestInit] => [
  `${API_BASE_URL}${path}`,
  {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  },
];

/**
 * RSC(Server Component)에서 사용. RSC는 쿠키를 쓸 수 없으므로 갱신을 시도하지
 * 않는다 — accessToken 최신 상태 보장은 middleware의 책임.
 */
export const serverFetch = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;

  const [url, init] = buildRequest(path, token, options);
  const res = await fetch(url, init);
  await throwIfError(res);
  return (await parseBody(res)) as T;
};

/**
 * Server Action에서 사용. Server Action은 쿠키를 쓸 수 있으므로, 401을 받으면
 * refreshToken으로 갱신을 시도하고 accessToken 쿠키를 새로 쓴 뒤 원 요청을 1회
 * 재시도한다. 갱신도 실패하면 두 쿠키를 지우고 원래 401 에러를 던진다.
 */
export const actionFetch = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;

  const [url, init] = buildRequest(path, token, options);
  const res = await fetch(url, init);

  if (res.status !== 401) {
    await throwIfError(res);
    return (await parseBody(res)) as T;
  }

  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    cookieStore.delete(ACCESS_TOKEN_COOKIE);
    cookieStore.delete(REFRESH_TOKEN_COOKIE);
    await throwIfError(res);
  }

  const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });

  if (!refreshRes.ok) {
    cookieStore.delete(ACCESS_TOKEN_COOKIE);
    cookieStore.delete(REFRESH_TOKEN_COOKIE);
    await throwIfError(res);
  }

  const { accessToken } = (await refreshRes.json()) as { accessToken: string };
  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ACCESS_TOKEN_MAX_AGE,
    path: "/",
  });

  const [retryUrl, retryInit] = buildRequest(path, accessToken, options);
  const retryRes = await fetch(retryUrl, retryInit);
  await throwIfError(retryRes);
  return (await parseBody(retryRes)) as T;
};
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add shared/constants/auth.ts shared/utils/api-client.ts
git commit -m "feat: BFF api-client 추가 (RSC용 serverFetch, Server Action용 actionFetch)"
```

---

### Task 2: 기존 서비스 함수 내부 구현 교체

**파일:**
- 수정: `features/campaign/services/api.ts`
- 수정: `features/dashboard/services/api.ts`

**인터페이스:**
- 소비: `serverFetch`/`actionFetch`(Task 1).
- 산출물: 시그니처는 그대로, 내부만 NestJS 백엔드 + 쿠키 기반 인증으로 교체. `features/campaign/services/actions.ts`, `app/@charts/page.tsx`, `app/@table/page.tsx`는 수정 불필요.

- [ ] **Step 1: `features/campaign/services/api.ts` 교체**

```ts
import { Campaign } from "@/shared/types";
import { serverFetch, actionFetch } from "@/shared/utils/api-client";

export const fetchCampaigns = async (): Promise<Campaign[]> => {
  return serverFetch<Campaign[]>("/campaigns");
};

export const updateCampaignStatus = async (
  id: string,
  status: string,
): Promise<void> => {
  await actionFetch(`/campaigns/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
};

export const createCampaign = async (
  campaign: Omit<Campaign, "id">,
): Promise<Campaign> => {
  return actionFetch<Campaign>("/campaigns", {
    method: "POST",
    body: JSON.stringify(campaign),
  });
};

export const deleteCampaign = async (id: string): Promise<void> => {
  await actionFetch(`/campaigns/${id}`, { method: "DELETE" });
};
```
`createCampaign`의 `CAMP-XXXXXX` id 생성은 Plan 3에서 서버 쪽(`CampaignsService.create`)으로 옮겼으므로 여기서는 더 이상 만들지 않는다 — 백엔드가 응답으로 돌려주는 `id`를 그대로 쓴다.

에러 처리: `actionFetch`가 던지는 `ApiError`는 `features/campaign/services/actions.ts`의 기존 `try/catch`(`e instanceof Error ? e.message : ...`)가 그대로 잡는다 — `ApiError extends Error`라 수정 불필요.

- [ ] **Step 2: `features/dashboard/services/api.ts` 교체**

```ts
import { DailyStat } from "@/shared/types";
import { serverFetch } from "@/shared/utils/api-client";

export const fetchDailyStats = async (): Promise<DailyStat[]> => {
  return serverFetch<DailyStat[]>("/daily-stats");
};
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add features/campaign/services/api.ts features/dashboard/services/api.ts
git commit -m "feat: 기존 서비스 함수가 NestJS 백엔드를 호출하도록 교체"
```

---

### Task 3: 로그인/로그아웃 Server Action + 로그인 페이지

**파일:**
- 생성: `features/auth/services/actions.ts`
- 생성: `app/login/page.tsx`

**인터페이스:**
- 소비: 없음(로그인은 인증 전이라 `serverFetch`/`actionFetch`를 안 씀 — 아직 토큰이 없으므로).
- 산출물: `loginAction(prevState, formData)`, `logoutAction()` — 로그인 페이지 폼과 (Task 5의) 로그아웃 버튼이 사용.

- [ ] **Step 1: 로그인/로그아웃 Server Action**

`features/auth/services/actions.ts`:
```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_BASE_URL } from "@/shared/constants/api";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE,
} from "@/shared/constants/auth";

type LoginState = { success: true } | { success: false; message: string };

export async function loginAction(
  _prevState: LoginState | null,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");

  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    return {
      success: false,
      message: body?.message ?? "로그인에 실패했습니다.",
    };
  }

  const { accessToken, refreshToken } = (await res.json()) as {
    accessToken: string;
    refreshToken: string;
  };

  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";

  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: ACCESS_TOKEN_MAX_AGE,
    path: "/",
  });
  cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: "/",
  });

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
  redirect("/login");
}
```
로그아웃은 설계 문서대로 상태 없음(백엔드 `/auth/logout` 호출은 생략 가능 — 어차피 서버는 아무 상태도 안 지움, Plan 2 참고) — 쿠키만 지우면 끝.

- [ ] **Step 2: 로그인 페이지**

`app/login/page.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { loginAction } from "@/features/auth/services/actions";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <form
        action={formAction}
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 dark:border-slate-800 p-6"
      >
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          관리자 로그인
        </h1>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm text-slate-600 dark:text-slate-400">
            이메일
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm text-slate-600 dark:text-slate-400">
            비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
          />
        </div>

        {state && !state.success && (
          <p className="text-sm text-red-600">{state.message}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded bg-slate-900 dark:bg-slate-100 text-slate-50 dark:text-slate-900 py-2 text-sm font-medium disabled:opacity-50"
        >
          {isPending ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}
```
`useActionState`는 React 19의 훅(이 프로젝트는 React 19.2 사용 — `package.json` 확인됨)이라 별도 설치 불필요.

- [ ] **Step 3: 커밋**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add features/auth app/login
git commit -m "feat: 로그인 페이지와 로그인/로그아웃 Server Action 추가"
```

---

### Task 4: 라우트 보호 미들웨어

**파일:**
- 생성: `middleware.ts` (저장소 루트, `app/`과 같은 레벨)

**인터페이스:**
- 소비: `API_BASE_URL`, 쿠키 상수(Task 1).
- 산출물: `/login`을 제외한 모든 경로에서 인증을 강제. `next-auth-boilerplate`의 `src/middleware.ts` 패턴을 그대로 가져오되, PROTECTED_ROUTES 목록 대신 "/login만 예외"로 단순화(설계 문서 요구사항과 일치).

- [ ] **Step 1: 미들웨어 작성**

`middleware.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/shared/constants/api";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_COOKIE,
} from "@/shared/constants/auth";

const LOGIN_PATH = "/login";

const tryRefresh = async (refreshToken: string): Promise<string | null> => {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const { accessToken } = (await res.json()) as { accessToken: string };
    return accessToken ?? null;
  } catch {
    return null;
  }
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLoginPage = pathname.startsWith(LOGIN_PATH);

  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  // 이미 인증된 상태로 /login 접근 → 대시보드로
  if (isLoginPage && (accessToken || refreshToken)) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (isLoginPage) return NextResponse.next();

  if (accessToken) return NextResponse.next();

  if (refreshToken) {
    const newAccessToken = await tryRefresh(refreshToken);
    if (newAccessToken) {
      const res = NextResponse.next();
      res.cookies.set(ACCESS_TOKEN_COOKIE, newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: ACCESS_TOKEN_MAX_AGE,
        path: "/",
      });
      return res;
    }
  }

  const loginUrl = new URL(LOGIN_PATH, req.url);
  loginUrl.searchParams.set("redirectTo", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 2: 브라우저로 검증**

```bash
pnpm run dev
```
- 시크릿 창에서 `http://localhost:3000/` 접속 → `/login`으로 리다이렉트되는지 확인.
- `server/.env`의 `ADMIN_EMAIL`/`ADMIN_PASSWORD`로 로그인 → 대시보드(`/`)로 이동, 차트/테이블에 실제 Postgres 데이터(캠페인 80개분)가 뜨는지 확인.
- 캠페인 상태 일괄 변경/등록/삭제가 실제로 DB에 반영되는지 확인(Prisma Studio로 재확인 가능).

- [ ] **Step 3: 커밋**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add middleware.ts
git commit -m "feat: 인증 미들웨어 추가 (라우트 보호 + 페이지 진입 시 토큰 갱신)"
```

---

### Task 5: 로그아웃 버튼

**파일:**
- 수정: `app/layout.tsx`

**인터페이스:**
- 소비: `logoutAction`(Task 3).

- [ ] **Step 1: 레이아웃에 로그아웃 버튼 추가**

`app/layout.tsx`의 `<main>` 안, `{children}` 위에 로그아웃 폼 추가:
```tsx
import { logoutAction } from "@/features/auth/services/actions";
```
```tsx
<main className="container mx-auto px-4 py-8 space-y-8 flex-1 w-full max-w-7xl">
  <form action={logoutAction} className="flex justify-end">
    <button
      type="submit"
      className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
    >
      로그아웃
    </button>
  </form>

  {children}

  <div className="w-full">{charts}</div>
  <div className="w-full">{table}</div>
</main>
```

- [ ] **Step 2: 브라우저로 검증**

로그아웃 버튼 클릭 → `/login`으로 이동 → `/`로 직접 URL 접근 시 다시 `/login`으로 튕기는지 확인.

- [ ] **Step 3: 커밋**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add app/layout.tsx
git commit -m "feat: 레이아웃에 로그아웃 버튼 추가"
```

---

## 이 계획의 완료 기준 (Definition of Done)

- [x] 로그인 안 한 상태로 `/` 접근 → `/login`으로 리다이렉트. (curl + 브라우저로 확인)
- [x] `server/.env`의 admin 계정으로 로그인 성공 → `/`로 이동, 차트/테이블에 실제 Postgres 데이터 표시. (브라우저로 확인)
- [x] 캠페인 상태 변경 / 등록이 실제 DB에 반영됨 — 브라우저에서 실행 후 `psql`로 직접 확인(Prisma Studio 대신).
- [ ] accessToken 쿠키 강제 삭제 후 새로고침 → 미들웨어 자동 갱신 — 코드 로직상 타당하나(refreshToken 있으면 `/auth/refresh` 호출 후 쿠키 재설정), httpOnly라 브라우저 JS로 쿠키를 지울 수 없어 실제 만료 시나리오는 **미검증**. 다음 세션에서 Chrome DevTools Application 탭으로 수동 확인 필요.
- [ ] refreshToken까지 만료된 뒤 `/login` 리다이렉트 — 위와 동일 이유로 미검증.
- [x] 로그아웃 버튼 클릭 → 쿠키 삭제, `/login`으로 이동, 로그아웃 상태에서 `/login` 재방문 시 테마 토글도 정상 동작(다크/라이트 전환 확인).
- [x] `npx tsc --noEmit`, `npx eslint .` 통과 — 남은 lint 에러 3개(`useCampaignForm.ts`, `chart.ts`, `ThemeToggle.tsx`)는 이 계획과 무관한 기존 이슈.

**계획에 없었지만 진행 중 발견/처리한 것:**
- 저장소를 `frontend/` + `server/` 구조로 재편(사용자 요청, `next-auth-boilerplate` 포트폴리오 반영 논의 중 결정) — `tsconfig.json`이 `app/features/shared`와 함께 이동해서 import 경로 변경 없음.
- `/login`이 대시보드 레이아웃(로그아웃 버튼, `@charts`/`@table` 슬롯)을 물려받지 않도록 `(dashboard)` 라우트 그룹으로 분리.
- 다크모드에서 Recharts 툴팁 hover 시 텍스트가 안 보이던 기존 버그 발견 및 수정(`CHART_CONFIG`에 다크모드 색상 추가, 3개 차트 컴포넌트에 `useTheme()` 적용).
- 로그인 페이지에 테마 토글 버튼 추가(기존엔 대시보드에만 있었음).
