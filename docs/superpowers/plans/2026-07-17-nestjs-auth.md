# NestJS Auth(JWT) 구현 계획

> **에이전트 작업자용:** 이 계획을 태스크 단위로 실행할 때는 superpowers:subagent-driven-development(추천) 또는 superpowers:executing-plans 서브스킬을 사용할 것. 각 스텝은 체크박스(`- [ ]`) 문법으로 추적한다.
>
> **이 계획의 실행 방식: TDD 없이 바로 구현.** (Plan 1 도중에 결정됨 — 이번 세션에서는 사람이 손타이핑/테스트먼저보다 속도를 원함.) 각 태스크는 바로 구현한 다음 테스트먼저 사이클 대신 `curl`/수동 확인으로 검증한다.

**목표:** NestJS API에 단일 admin JWT 로그인 붙이기 — `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, 나머지 모든 라우트는 전역 `JwtAuthGuard`로 기본 보호(`@Public()`으로 예외 처리).

**아키텍처:** Passport의 `jwt` 전략이 `Authorization: Bearer <accessToken>` 헤더를 `JWT_SECRET`으로 검증한다. 별도의, 수동으로 검증하는 리프레시 흐름(두 번째 Passport 전략이 아니라)이 `AuthService` 안에서 `refreshToken`을 `JWT_REFRESH_SECRET`으로 확인한다. 가드는 `APP_GUARD`로 전역 등록되어 기본적으로 막고, 라우트는 `@Public()` 데코레이터로 예외 처리한다 — 이 계획에서 공개 라우트는 `/health`와 `/auth/*`뿐.

**기술 스택:** `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `class-validator`, `class-transformer`, bcrypt(Plan 1에서 이미 설치됨).

## 전역 제약사항

- 단일 admin, 회원가입 없음, 멀티유저 없음 — 설계 문서의 non-goal과 일치. admin 행은 이미 Postgres에 존재(Plan 1 Task 6에서 `ADMIN_EMAIL`/`ADMIN_PASSWORD`로 시딩됨).
- accessToken: 15분. refreshToken: 7일. 설계 문서의 정확한 값 — 바꾸지 말 것.
- refresh token rotation이나 revocation list 없음(설계 문서의 "열린 질문" 섹션이 시간 예산을 고려해 이 최소 구현을 명시적으로 허용함) — `POST /auth/refresh`는 기존 refreshToken을 검증만 하고 새 accessToken을 재발급한다.
- 토큰은 **JSON 응답 본문**으로 반환, `Set-Cookie`는 절대 안 씀 — 설계 문서의 BFF 패턴에서는 Next.js(Plan 4)가 httpOnly 쿠키를 설정하지, 이 API가 하는 게 아님.
- `/health`는 계속 인증 없이 접근 가능해야 함 — Railway/Render 헬스체크가 인증 없이 여길 호출함.
- 전역 `ValidationPipe`(whitelist + transform)와 에러를 `{ statusCode, message }`로 정규화하는 전역 예외 필터, 설계 문서의 "모듈 구성"과 "에러 처리" 섹션 기준.

---

### Task 1: 인증 관련 의존성 설치

**파일:**
- 수정: `server/package.json`, `server/pnpm-lock.yaml`

- [ ] **Step 1: 설치**

`server/` 안에서 실행:
```bash
pnpm add @nestjs/jwt @nestjs/passport passport passport-jwt class-validator class-transformer
pnpm add -D @types/passport-jwt
```
새로 설치하는 패키지에서 `[ERR_PNPM_IGNORED_BUILDS]`가 뜨면, `server/pnpm-workspace.yaml`의 `allowBuilds: <pkg>: true`와 `onlyBuiltDependencies`에 추가하고 `pnpm install`을 다시 실행(Plan 1과 동일한 수정 방법).

- [ ] **Step 2: 로컬 개발용 실제 JWT 시크릿 설정**

`server/.env`를 수정해서 `.env.example`에서 넘어온 `JWT_SECRET`/`JWT_REFRESH_SECRET` 플레이스홀더를 교체:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
이걸 두 번 실행해서 각 결과를 `server/.env`에 붙여넣기:
```
JWT_SECRET="<첫 번째 랜덤 hex 문자열>"
JWT_REFRESH_SECRET="<두 번째 랜덤 hex 문자열>"
```
반드시 서로 다른 값이어야 함 — access용으로 서명된 토큰이 refresh 토큰으로도 유효 검증되면 절대 안 됨.

- [ ] **Step 3: 커밋**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/package.json server/pnpm-lock.yaml server/pnpm-workspace.yaml
git commit -m "chore: add JWT/Passport/class-validator dependencies"
```

---

### Task 2: `@Public()` 데코레이터 + 전역 `ValidationPipe` + 전역 예외 필터

**파일:**
- 생성: `server/src/auth/public.decorator.ts`
- 생성: `server/src/common/http-exception.filter.ts`
- 수정: `server/src/main.ts`
- 수정: `server/src/health/health.controller.ts` (public 표시 — 아직 빠져나갈 가드가 없지만, 이 데코레이터가 처음 쓰이는 곳)

**인터페이스:**
- 산출물: `Public()` 데코레이터(`server/src/auth/public.decorator.ts`)와 메타데이터 키 `IS_PUBLIC_KEY` — Task 4의 `JwtAuthGuard`가 사용.

- [ ] **Step 1: `@Public()` 데코레이터 작성**

`server/src/auth/public.decorator.ts`:
```ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

- [ ] **Step 2: 전역 예외 필터 작성**

`server/src/common/http-exception.filter.ts`:
```ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? this.extractMessage(exception)
        : '서버 오류가 발생했습니다.';

    response.status(statusCode).json({ statusCode, message });
  }

  private extractMessage(exception: HttpException): string | string[] {
    const body = exception.getResponse();
    if (typeof body === 'string') return body;
    if (typeof body === 'object' && body !== null && 'message' in body) {
      return (body as { message: string | string[] }).message;
    }
    return exception.message;
  }
}
```

- [ ] **Step 3: 필터와 validation pipe를 `main.ts`에 연결**

`server/src/main.ts`:
```ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
```

- [ ] **Step 4: `/health`를 public으로 표시**

`server/src/health/health.controller.ts` — `@Controller('health')` 위에 `@Public()` 데코레이터 추가:
```ts
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/public.decorator';

@Public()
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

- [ ] **Step 5: 아무것도 안 깨졌는지 확인**

실행: `pnpm run start:dev`, 그다음 `curl -s http://localhost:3001/health`
기대 결과: `{"status":"ok"}` (아직 막을 가드가 없으니, 이건 그냥 새 파일들이 컴파일되고 `main.ts`가 여전히 부팅되는지 확인하는 것).

- [ ] **Step 6: 커밋**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/src/auth/public.decorator.ts server/src/common server/src/main.ts server/src/health/health.controller.ts
git commit -m "feat: add global ValidationPipe, exception filter, @Public() decorator"
```

---

### Task 3: `AuthService` — admin 검증, 토큰 발급/재발급

**파일:**
- 생성: `server/src/auth/dto/login.dto.ts`
- 생성: `server/src/auth/auth.service.ts`

**인터페이스:**
- 소비: `PrismaService`(Plan 1)의 `prisma.admin.findUnique`.
- 산출물: `AuthService.validateAdmin(email, password): Promise<Admin | null>`, `AuthService.login(admin): { accessToken: string; refreshToken: string }`, `AuthService.refresh(refreshToken: string): Promise<{ accessToken: string }>` — Task 5의 `AuthController`가 사용.

- [ ] **Step 1: 로그인 DTO 작성**

`server/src/auth/dto/login.dto.ts`:
```ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}
```

- [ ] **Step 2: `AuthService` 작성**

`server/src/auth/auth.service.ts`:
```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateAdmin(email: string, password: string) {
    const admin = await this.prisma.admin.findUnique({ where: { email } });
    if (!admin) return null;

    const passwordMatches = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordMatches) return null;

    return admin;
  }

  login(admin: { id: string; email: string }) {
    const payload = { sub: admin.id, email: admin.email };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m',
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; email: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('리프레시 토큰이 유효하지 않습니다.');
    }

    const accessToken = this.jwtService.sign(
      { sub: payload.sub, email: payload.email },
      { secret: process.env.JWT_SECRET, expiresIn: '15m' },
    );

    return { accessToken };
  }
}
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/src/auth/dto server/src/auth/auth.service.ts
git commit -m "feat: add AuthService (validate admin, issue/refresh JWTs)"
```

---

### Task 4: Passport JWT 전략 + 전역 `JwtAuthGuard`

**파일:**
- 생성: `server/src/auth/jwt.strategy.ts`
- 생성: `server/src/auth/jwt-auth.guard.ts`

**인터페이스:**
- 소비: `IS_PUBLIC_KEY`(Task 2)를 `Reflector`로 조회.
- 산출물: `JwtAuthGuard`, Task 6에서 `APP_GUARD`로 전역 등록 — 앞으로 만들 모든 컨트롤러(Plan 3의 `CampaignsController`/`DailyStatsController`)가 라우트별 설정 없이 기본으로 보호됨.

- [ ] **Step 1: Passport 전략 작성**

`server/src/auth/jwt.strategy.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  validate(payload: { sub: string; email: string }) {
    return { id: payload.sub, email: payload.email };
  }
}
```
`validate()`가 반환하는 값은 이후 모든 컨트롤러에서 `request.user`가 된다 — 이 프로젝트에 사용자별 데이터가 있었다면 Plan 3의 `CampaignsController`가 이렇게 호출자를 알았을 것이다(지금은 단일 admin이라 그럴 일 없지만, 패턴은 이미 갖춰짐).

- [ ] **Step 2: 전역 가드 작성**

`server/src/auth/jwt-auth.guard.ts`:
```ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    return super.canActivate(context);
  }
}
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/src/auth/jwt.strategy.ts server/src/auth/jwt-auth.guard.ts
git commit -m "feat: add Passport JWT strategy and global JwtAuthGuard"
```

---

### Task 5: `AuthController` + `AuthModule`, 전역 등록

**파일:**
- 생성: `server/src/auth/auth.controller.ts`
- 생성: `server/src/auth/auth.module.ts`
- 수정: `server/src/app.module.ts`

**인터페이스:**
- 소비: `AuthService`(Task 3), `JwtAuthGuard`(Task 4).
- 산출물: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`. 이제 앱의 나머지 모든 라우트가 기본적으로 가드로 보호됨.

- [ ] **Step 1: `AuthController` 작성**

`server/src/auth/auth.controller.ts`:
```ts
import { Body, Controller, HttpCode, HttpStatus, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './public.decorator';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const admin = await this.authService.validateAdmin(dto.email, dto.password);
    if (!admin) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    return this.authService.login(admin);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('리프레시 토큰이 필요합니다.');
    }
    return this.authService.refresh(refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout() {
    // 상태 없는 로그아웃 — 쿠키 삭제는 Next.js(Plan 4)가 처리.
    return { success: true };
  }
}
```

- [ ] **Step 2: `AuthModule` 작성**

`server/src/auth/auth.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
```
`JwtModule.register({})`를 일부러 비워둠 — `AuthService`와 `JwtStrategy` 둘 다 호출마다 `secret`/`expiresIn`을 명시적으로 넘기기 때문(Task 3), access와 refresh 토큰이 서로 다른 시크릿을 써야 해서다. 여기에 모듈 레벨 기본값을 두면 오히려 헷갈린다.

- [ ] **Step 3: `AuthModule`과 전역 가드를 `AppModule`에 등록**

`server/src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
```

- [ ] **Step 4: curl로 전체 흐름 검증**

개발 서버 재시작(`pnpm run start:dev`) 후:
```bash
# 1. 루트 라우트가 이제 인증을 요구함 (AppController는 @Public()이 아님)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/
# 기대 결과: 401

# 2. health는 계속 공개
curl -s http://localhost:3001/health
# 기대 결과: {"status":"ok"}

# 3. 시딩된 admin으로 로그인 (server/.env의 ADMIN_EMAIL/ADMIN_PASSWORD 사용)
curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"<실제 ADMIN_PASSWORD>"}'
# 기대 결과: {"accessToken":"...","refreshToken":"..."}

# 4. accessToken으로 방금 401이었던 루트 라우트 접근
curl -s -H "Authorization: Bearer <3번 결과의 accessToken>" \
  -o /dev/null -w "%{http_code}\n" http://localhost:3001/
# 기대 결과: 200

# 5. Refresh
curl -s -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<3번 결과의 refreshToken>"}'
# 기대 결과: {"accessToken":"..."} (새로 발급된 것)

# 6. 잘못된 비밀번호
curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"wrong"}'
# 기대 결과: {"statusCode":401,"message":"이메일 또는 비밀번호가 올바르지 않습니다."}
```

- [ ] **Step 5: 커밋**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/src/auth/auth.controller.ts server/src/auth/auth.module.ts server/src/app.module.ts
git commit -m "feat: wire AuthController/AuthModule, guard all routes globally by default"
```

---

## 이 계획의 완료 기준 (Definition of Done)

- [x] `GET /`(토큰 없음) → 401. `GET /health`(토큰 없음) → 200.
- [x] 올바른 admin 계정으로 `POST /auth/login` → `{ accessToken, refreshToken }`. 잘못된 비밀번호 → `{ statusCode, message }` 형태로 401.
- [x] `Authorization: Bearer` 헤더에 accessToken을 넣으면 `GET /` 접근 가능(200).
- [x] 유효한 refreshToken으로 `POST /auth/refresh` → 새 `{ accessToken }`.
- [x] `pnpm test`와 `pnpm run test:e2e` 여전히 통과 — `test/app.e2e-spec.ts`를 (방치하지 않고) 업데이트함: `GET /`가 이제 `@Public()`이 아니므로 401을 검증하도록 바꿈, 이건 의도된 전역 가드 동작이지 버그가 아님.

**원래 태스크 스텝엔 없었지만 필요했던 Jest 관련 수정 2건:**
- `jwt.strategy.ts`에서 `process.env.JWT_SECRET`에 `as string`이 필요했음 — passport-jwt의 `secretOrKey` 타입이 `string | undefined`를 받지 않음.
- Jest는 `main.ts`를 절대 실행하지 않아서 테스트에서는 `.env`가 로드된 적이 없었고, `JwtStrategy`가 `requires a secret or key`를 던졌음 — `server/test/jest-e2e.json`과 `server/package.json`의 `"jest"` 블록 양쪽에 `"setupFiles": ["dotenv/config"]`를 추가해서 해결.
