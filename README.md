# 🚀 마케팅 캠페인 성과 대시보드

![CI](https://github.com/joowonhyun/marketing-dashboard/actions/workflows/ci.yml/badge.svg)

실시간 마케팅 성과를 시각화하고 캠페인을 효율적으로 관리하기 위한 풀스택 웹 애플리케이션입니다.
Next.js(App Router)와 NestJS를 BFF(Backend-for-Frontend) 패턴으로 연결하고, JWT 인증으로 대시보드 전체를 보호합니다. <br/>
https://www.marketing-dashboard.site


---

## 📑 목차

1.  [프로젝트 개요](#-프로젝트-개요)
2.  [기술 스택](#-기술-스택)
3.  [아키텍처](#-아키텍처)
4.  [주요 기능 및 UI](#-주요-기능-및-ui)
5.  [설계 하이라이트](#-설계-하이라이트)
6.  [트러블슈팅](#-트러블슈팅)
7.  [폴더 구조](#-폴더-구조)

---

## 🎯 프로젝트 개요

원래 `json-server` 목업으로 시작한 프론트엔드 토이프로젝트를 백엔드(NestJS + PostgreSQL)와 JWT 인증을 갖춘 풀스택 프로젝트로 확장했습니다. 브라우저는 NestJS API를 절대 직접 호출하지 않고, Next.js 서버가 유일한 클라이언트가 되는 BFF 구조를 채택해 JWT가 브라우저 JavaScript에 전혀 노출되지 않도록 설계했습니다.

- 다크/라이트 모드 완전 지원 (차트 툴팁까지 테마 인식)
- httpOnly 쿠키 기반 JWT 인증 — accessToken 15분 / refreshToken 7일, 세션 만료 시 자동 갱신
- 캠페인 목록 조회, 등록, 상태 일괄 변경, 일괄 삭제 — 전부 실제 Postgres 데이터로 동작

> 이 프로젝트는 회원가입 없이 데모 계정 하나를 공유합니다. 캠페인 등록/상태변경/삭제를
> 자유롭게 테스트해 보세요 — 매일 00:00(KST)에 원본 데이터로 자동 초기화됩니다.

---
## 🛠 기술 스택

### Frontend

| 분류          | 기술                     | 선택 이유                                                   |
| :------------ | :----------------------- | :----------------------------------------------------------- |
| **Framework** | **Next.js 16 (App Router)** | RSC 기반 서버 사이드 페칭, Parallel Routes, Server Actions   |
| **State**     | **Zustand**              | 전역 필터(날짜/상태/매체)의 효율적인 구독 및 동기화           |
| **Style**     | **Tailwind CSS**         | 유틸리티 우선 스타일링 및 다크모드 테마 시스템                |
| **Chart**     | **Recharts**             | 반응형 지원 및 선언적 차트 인터페이스                          |
| **Form**      | **React Hook Form + Zod**| 스키마 기반 유효성 검사, 서버(NestJS DTO)와 규칙 이중화        |

### Backend

| 분류           | 기술                          | 선택 이유                                                  |
| :------------- | :---------------------------- | :---------------------------------------------------------- |
| **Framework**  | **NestJS 11**                 | 모듈 기반 구조, DI, 데코레이터 기반 검증/가드                |
| **ORM**        | **Prisma 7**                  | 타입 안전 쿼리, driver adapter 기반 PostgreSQL 연결          |
| **Database**   | **PostgreSQL 16** (Docker)     | 관계형 데이터(Campaign ↔ DailyStat) 무결성 보장               |
| **Auth**       | **Passport JWT**               | accessToken/refreshToken 이중 발급, 전역 가드로 기본 보호      |
| **Validation** | **class-validator**            | 프론트엔드 zod 스키마와 동일한 규칙을 서버에도 이중 적용        |

---

## 🏗 아키텍처

```
[Browser] --(same-origin httpOnly cookie)--> [Next.js Server] --(Authorization: Bearer JWT)--> [NestJS API] --(Prisma)--> [PostgreSQL]
```

- **브라우저는 NestJS를 직접 호출하지 않습니다.** 로그인 시 발급받은 accessToken/refreshToken을 Next.js가 httpOnly 쿠키로 저장하고, 이후 모든 API 호출은 Next.js 서버(Server Component / Server Action)가 쿠키에서 토큰을 읽어 `Authorization` 헤더로 NestJS에 전달합니다.
- 이 구조 덕분에 JWT가 XSS로 탈취될 경로 자체가 없고, 크로스도메인 쿠키 문제나 CORS 설정도 사실상 불필요합니다.
- `middleware.ts`가 페이지 진입마다 인증 상태를 검사하고, accessToken이 만료됐지만 refreshToken이 살아있으면 사용자가 눈치채지 못하게 자동으로 재발급합니다. Server Action(캠페인 등록/상태변경/삭제) 도중 토큰이 만료되면 그 자리에서 갱신 후 원래 요청을 재시도합니다.

---

## ✨ 주요 기능 및 UI

### 1. 데이터 시각화 대시보드

일별 추이, 매체별 성과, 우수 캠페인을 직관적으로 파악할 수 있습니다. 차트 hover 툴팁까지 다크/라이트 테마를 인식합니다.

|                 다크 모드 (Dark)                  |                 라이트 모드 (Light)                 |
| :-----------------------------------------------: | :-------------------------------------------------: |
| ![Dashboard Dark](frontend/public/docs/dashboard_dark.png) | ![Dashboard Light](frontend/public/docs/dashboard_light.png) |

### 2. 캠페인 관리 테이블

상태 변경, 일괄 삭제, 실시간 검색 등 관리 기능을 제공하며, 모든 변경은 실제 Postgres에 반영됩니다.

|                 캠페인 관리 (Dark)                 |                 캠페인 관리 (Light)                  |
| :------------------------------------------------: | :--------------------------------------------------: |
| ![Table Dark](frontend/public/docs/campaign_table_dark.png) | ![Table Light](frontend/public/docs/campaign_table_light.png) |

### 3. 인증

단일 관리자 로그인으로 대시보드 전체를 보호합니다. 로그인하지 않은 상태로 어떤 경로에 접근해도 `/login`으로 리다이렉트되며, 세션 중 accessToken이 만료돼도 사용자는 재로그인 없이 계속 작업할 수 있습니다.

---

## 💡 설계 하이라이트

### httpOnly 쿠키 + BFF — XSS로부터 완전 격리된 토큰 저장

JWT를 `localStorage`나 일반 쿠키가 아닌 httpOnly 쿠키로만 다뤄서 JavaScript가 토큰에 접근할 방법 자체를 없앴습니다. 이걸 가능하게 하려고 프론트엔드가 API 클라이언트를 컨텍스트별로 분리했습니다: RSC(`serverFetch`)는 쿠키를 읽기만 하고, Server Action(`actionFetch`)은 쿠키를 쓸 수 있으므로 401을 받으면 그 자리에서 refreshToken으로 갱신 후 재시도합니다. Next.js의 RSC는 쿠키 쓰기가 금지되어 있다는 제약을 그대로 반영한 설계입니다.

### 프론트/백엔드 이중 유효성 검사

`features/campaign/schemas/campaignFormSchema.ts`의 zod 규칙(이름 2~100자, 예산 100~10억원, 종료일 > 시작일)을 NestJS DTO의 class-validator 데코레이터에도 그대로 반영했습니다. 클라이언트 검증을 우회해 직접 API를 호출해도 동일한 규칙이 서버에서 다시 강제됩니다.

### 지저분한 실데이터에 대한 정규화

시딩 대상 `db.json`에는 `platform: "네이버"/"facebook"/"Facebook"`, `status: "running"/"stopped"` 같은 비정형 값과 `budget: "2000000원"`처럼 타입이 섞인 필드가 실제로 존재합니다. 프론트엔드에 이미 이런 값을 표준값(`Google`/`Naver`/`Meta`, `active`/`paused`/`ended`)으로 정규화하는 유틸(`shared/utils/dataset.ts`)이 있다는 걸 확인하고, 백엔드 시딩 스크립트에도 동일한 정규화 규칙을 그대로 미러링해서 프론트-백엔드 간 데이터 해석이 어긋나지 않도록 했습니다.

### Parallel Routes로 체감 성능 확보

Recharts는 번들 크기가 크고 초기 렌더 연산량이 많습니다. `@charts`/`@table` Parallel Routes로 두 영역을 독립적으로 로딩해서, 무거운 차트가 준비되는 동안에도 나머지 레이아웃이 먼저 사용자에게 노출되도록 했습니다.

### no-store 전략

모든 데이터 페칭에 캐싱보다 정확성을 우선하는 `no-store` 전략을 적용했습니다. 캠페인 상태를 변경하거나 새로 등록한 직후에도 항상 최신 Postgres 데이터를 보장합니다.

### 매직 넘버 중앙 관리

컴포넌트 내부에 흩어져 있던 하드코딩 수치(예산 한도, 페이지 크기, 차트 색상 등)를 `shared/constants/`로 모아, 정책이 바뀌어도 한 곳만 수정하면 되도록 구조화했습니다.

---

## 🔧 트러블슈팅

### 빌드된 서버 파일 위치가 예상과 달랐습니다

`nest build`를 돌리면 원래 `server/dist/main.js`가 나오고, `node dist/main`으로 실행하면 됩니다. Render에 처음 배포하고 그대로 실행했더니 `Cannot find module`. 서버가 안 켜졌습니다.

`dist/`를 열어보니 `main.js`가 `dist/main.js`가 아니라 `dist/src/main.js`에 가 있었습니다. `prisma/schema.prisma`를 보니 이런 설정이 있었습니다.

```
output = "../generated/prisma"
```

이 경로는 `schema.prisma` 파일이 있는 위치(`server/prisma/`) 기준입니다. `..`로 한 칸 올라가면 `server/`, 거기서 `generated/prisma`로 들어가니 최종 위치는 `server/generated/prisma`.

```
server/
├── prisma/
│   └── schema.prisma   ← output 설정이 여기 있음
├── src/                 ← 앱 코드
└── generated/           ← output이 실제로 가리키는 곳
    └── prisma/
```

`src/` 안이 아니라 `src/` 옆에 생기는 구조였습니다. (Prisma 7의 새 제너레이터가 `node_modules` 대신 이 자리를 권장해서 그렇게 잡혀 있었습니다.)

TypeScript는 `rootDir`을 안 정해주면 컴파일 대상 파일들의 공통 상위 폴더를 알아서 잡습니다. `src/` 바깥에 `generated/prisma/`랑 시딩 설정 파일 `prisma.config.ts`가 있다 보니 기준 폴더가 `src/`가 아니라 `server/` 전체로 넓어져 있었고, 빌드 결과물도 `src/` 구조를 그대로 따라간 `dist/src/main.js`에 만들어지고 있었던 겁니다. 로컬은 빌드 없이 바로 실행하는 `pnpm start:dev`만 써서 몰랐습니다.

처음엔 실행 스크립트를 `node dist/src/main`으로 고쳐서 넘어갔는데, 원인은 안 건드리고 증상만 우회한 거라 찜찜했습니다. 그래서 Prisma 출력 경로를 `src/generated/prisma`로 옮기고, `prisma.config.ts`와 `prisma/` 폴더는 `tsconfig.build.json`의 `exclude`에 넣었습니다(시딩은 `tsx prisma/seed.ts`로 따로 돌아가니 빌드에 안 껴도 됩니다). 이제 tsc가 보는 파일이 전부 `src/` 안에만 있어서 `rootDir`이 자연스럽게 `src/`로 잡히고, `dist/main.js`가 제자리에 생깁니다. 실행 스크립트도 `node dist/main`으로 되돌렸습니다.

### Render의 "Root Directory" 설정을 `server/`로 잡으면 안 되는 이유

Render엔 "이 저장소에서 어느 폴더를 기준으로 빌드·실행할지" 정하는 Root Directory 옵션이 있습니다. `frontend/`와 `server/`가 한 저장소에 같이 있는 구조라, 백엔드 배포할 땐 당연히 `server/`로 잡아야 할 것 같았습니다.

그런데 걸리는 게 하나 있었습니다. 매일 자정 캠페인 데이터를 리셋하는 기능이 참조하는 원본 파일 `db.json`이 `server/` 안이 아니라 저장소 맨 위에 있습니다. Root Directory를 `server/`로 잡으면 Render는 그 폴더만 가져오니, 바깥에 있는 `db.json`은 서버 입장에서 없는 파일이 됩니다. 배포는 멀쩡히 성공해서 겉으로는 문제가 없어 보이지만, 리셋 기능을 실제로 실행하는 순간 파일을 못 찾아 조용히 죽었을 상황이었습니다.

직접 겪은 건 아니고, 배포 전에 Render 문서를 읽다가 미리 발견했습니다. Root Directory는 비워서 저장소 전체를 가져오게 하고, 대신 Build/Start Command 맨 앞에 `cd server &&`를 붙여 그 안에서 명령어가 돌게 했습니다.

### GitHub Actions `schedule`이 생각보다 안 돌았습니다

Render 무료 티어는 15분 넘게 요청이 없으면 슬립 상태로 들어가고, 다시 깨어나는 데 30~60초가 걸립니다. 포트폴리오를 처음 열어본 사람이 로딩만 1분 가까이 붙잡고 있으면 곤란하겠다 싶어서, 5분마다 헬스체크 핑을 보내는 GitHub Actions 워크플로(`schedule: */5 * * * *`)를 먼저 붙여봤습니다. 그런데 실제로는 최초 푸시 후 80분 동안 단 한 번도 안 돌았고, 재푸시해서 겨우 한 번 돈 다음엔 또 29분 동안 잠잠했습니다. 이 정도면 GitHub의 schedule 트리거를 믿고 갈 수는 없겠다 싶어서 워크플로는 지우고, 대신 외부 uptime 모니터링 서비스(UptimeRobot)가 5분마다 직접 헬스체크 핑을 쏘도록 바꿨습니다. 계산해보니 이러면 한 달에 720~744시간 정도 깨어있는 셈인데, 마침 Render 무료 티어 한도(750시간)는 안 넘어서 이 방식으로 정리했습니다.

---

## 📂 폴더 구조

```
marketing-dashboard/
├── frontend/               # Next.js 앱 (Vercel 배포 대상)
│   ├── app/                # 라우팅 (auth 미들웨어, (dashboard) 라우트 그룹)
│   ├── features/           # 도메인별 캡슐화 (campaign, dashboard, filter, auth)
│   └── shared/              # 공용 컴포넌트, 유틸, 타입, api-client
├── server/                 # NestJS API (Railway/Render 배포 대상)
│   ├── src/
│   │   ├── auth/            # JWT 로그인/리프레시, 전역 가드
│   │   ├── campaigns/       # 캠페인 CRUD
│   │   ├── daily-stats/     # 일별 통계 조회
│   │   └── prisma/          # PrismaService
│   └── prisma/schema.prisma
├── docker-compose.yml       # 로컬 개발용 PostgreSQL
├── db.json                  # 시딩 소스 데이터 (80 캠페인 / 1,422 daily stats)
└── docs/                    # 구현 계획 및 설계 문서
```
