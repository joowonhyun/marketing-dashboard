# NestJS Auth (JWT) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution mode for this plan: direct implementation, no TDD.** (Decided partway through Plan 1 — the human wants speed over hand-typing/test-first this session.) Each task is implemented directly, then verified with `curl`/manual checks instead of a test-first cycle.

**Goal:** Single-admin JWT login for the NestJS API — `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, with every other route protected by a global `JwtAuthGuard` by default (opt out with `@Public()`).

**Architecture:** Passport's `jwt` strategy validates the `Authorization: Bearer <accessToken>` header against `JWT_SECRET`. A separate, manually-verified refresh flow (not a second Passport strategy) checks `refreshToken` against `JWT_REFRESH_SECRET` inside `AuthService`. The guard is registered globally via `APP_GUARD` and denies by default; routes opt out with a `@Public()` decorator — `/health` and `/auth/*` are the only public routes in this plan.

**Tech Stack:** `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `class-validator`, `class-transformer`, bcrypt (already installed from Plan 1).

## Global Constraints

- Single admin, no signup, no multi-user — matches the design doc's non-goals. The admin row already exists in Postgres (seeded in Plan 1 Task 6 from `ADMIN_EMAIL`/`ADMIN_PASSWORD`).
- Access token: 15 minutes. Refresh token: 7 days. Exact values from the design doc — don't change them.
- No refresh-token rotation or revocation list (the design doc's "열린 질문" section explicitly allows this minimal version given the time budget) — `POST /auth/refresh` just verifies the existing refresh token and reissues a new access token.
- Tokens are returned as **JSON response bodies**, never `Set-Cookie` — the design doc's BFF pattern has Next.js (Plan 4) set the httpOnly cookies, not this API.
- `/health` must stay publicly reachable (no auth) — Railway/Render health checks hit it unauthenticated.
- Global `ValidationPipe` (whitelist + transform) and a global exception filter normalizing errors to `{ statusCode, message }`, per the design doc's "모듈 구성" and "에러 처리" sections.

---

### Task 1: Install auth dependencies

**Files:**
- Modify: `server/package.json`, `server/pnpm-lock.yaml`

- [ ] **Step 1: Install**

Run inside `server/`:
```bash
pnpm add @nestjs/jwt @nestjs/passport passport passport-jwt class-validator class-transformer
pnpm add -D @types/passport-jwt
```
If `[ERR_PNPM_IGNORED_BUILDS]` appears for any new package, add it to `server/pnpm-workspace.yaml` under `allowBuilds: <pkg>: true` and `onlyBuiltDependencies`, then re-run `pnpm install` (same fix as Plan 1).

- [ ] **Step 2: Set real JWT secrets for local dev**

Edit `server/.env`, replacing the `JWT_SECRET`/`JWT_REFRESH_SECRET` placeholders carried over from `.env.example`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Run that twice, paste each result into `server/.env`:
```
JWT_SECRET="<first random hex string>"
JWT_REFRESH_SECRET="<second random hex string>"
```
They must be different values — a token signed for access must never verify as a valid refresh token.

- [ ] **Step 3: Commit**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/package.json server/pnpm-lock.yaml server/pnpm-workspace.yaml
git commit -m "chore: add JWT/Passport/class-validator dependencies"
```

---

### Task 2: `@Public()` decorator + global `ValidationPipe` + global exception filter

**Files:**
- Create: `server/src/auth/public.decorator.ts`
- Create: `server/src/common/http-exception.filter.ts`
- Modify: `server/src/main.ts`
- Modify: `server/src/health/health.controller.ts` (mark public — it has no guard to opt out of yet, but this is where the decorator gets used first)

**Interfaces:**
- Produces: `Public()` decorator (`server/src/auth/public.decorator.ts`) and its metadata key `IS_PUBLIC_KEY`, consumed by `JwtAuthGuard` in Task 4.

- [ ] **Step 1: Write the `@Public()` decorator**

`server/src/auth/public.decorator.ts`:
```ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

- [ ] **Step 2: Write the global exception filter**

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

- [ ] **Step 3: Wire the filter and validation pipe into `main.ts`**

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

- [ ] **Step 4: Mark `/health` public**

`server/src/health/health.controller.ts` — add the `@Public()` decorator above `@Controller('health')`:
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

- [ ] **Step 5: Verify nothing broke**

Run: `pnpm run start:dev`, then `curl -s http://localhost:3001/health`
Expected: `{"status":"ok"}` (no guard exists yet to block anything, this just confirms the new files compile and `main.ts` still boots).

- [ ] **Step 6: Commit**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/src/auth/public.decorator.ts server/src/common server/src/main.ts server/src/health/health.controller.ts
git commit -m "feat: add global ValidationPipe, exception filter, @Public() decorator"
```

---

### Task 3: `AuthService` — validate admin, issue and refresh tokens

**Files:**
- Create: `server/src/auth/dto/login.dto.ts`
- Create: `server/src/auth/auth.service.ts`

**Interfaces:**
- Consumes: `PrismaService` (Plan 1) for `prisma.admin.findUnique`.
- Produces: `AuthService.validateAdmin(email, password): Promise<Admin | null>`, `AuthService.login(admin): { accessToken: string; refreshToken: string }`, `AuthService.refresh(refreshToken: string): Promise<{ accessToken: string }>` — consumed by `AuthController` in Task 5.

- [ ] **Step 1: Write the login DTO**

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

- [ ] **Step 2: Write `AuthService`**

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

- [ ] **Step 3: Commit**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/src/auth/dto server/src/auth/auth.service.ts
git commit -m "feat: add AuthService (validate admin, issue/refresh JWTs)"
```

---

### Task 4: Passport JWT strategy + global `JwtAuthGuard`

**Files:**
- Create: `server/src/auth/jwt.strategy.ts`
- Create: `server/src/auth/jwt-auth.guard.ts`

**Interfaces:**
- Consumes: `IS_PUBLIC_KEY` (Task 2) via `Reflector`.
- Produces: `JwtAuthGuard`, registered globally as `APP_GUARD` in Task 6 — every future controller (Plan 3's `CampaignsController`/`DailyStatsController`) is protected by default with no per-route setup needed.

- [ ] **Step 1: Write the Passport strategy**

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
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  validate(payload: { sub: string; email: string }) {
    return { id: payload.sub, email: payload.email };
  }
}
```
Whatever `validate()` returns becomes `request.user` in every controller downstream — this is how Plan 3's `CampaignsController` would know who's calling, if this project had per-user data (it doesn't; single admin, but the pattern's there).

- [ ] **Step 2: Write the global guard**

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

- [ ] **Step 3: Commit**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/src/auth/jwt.strategy.ts server/src/auth/jwt-auth.guard.ts
git commit -m "feat: add Passport JWT strategy and global JwtAuthGuard"
```

---

### Task 5: `AuthController` + `AuthModule`, registered globally

**Files:**
- Create: `server/src/auth/auth.controller.ts`
- Create: `server/src/auth/auth.module.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `AuthService` (Task 3), `JwtAuthGuard` (Task 4).
- Produces: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`. Every other route in the app is now guarded by default.

- [ ] **Step 1: Write `AuthController`**

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

- [ ] **Step 2: Write `AuthModule`**

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
`JwtModule.register({})` is intentionally empty — `AuthService` and `JwtStrategy` both pass `secret`/`expiresIn` explicitly per call (Task 3), since access and refresh tokens need different secrets. A module-level default here would be misleading.

- [ ] **Step 3: Register `AuthModule` and the global guard in `AppModule`**

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

- [ ] **Step 4: Verify the full flow with curl**

Restart the dev server (`pnpm run start:dev`), then:
```bash
# 1. Root route now requires auth (AppController isn't @Public())
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/
# Expected: 401

# 2. Health stays public
curl -s http://localhost:3001/health
# Expected: {"status":"ok"}

# 3. Login with the seeded admin (use the ADMIN_EMAIL/ADMIN_PASSWORD from server/.env)
curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"<your ADMIN_PASSWORD>"}'
# Expected: {"accessToken":"...","refreshToken":"..."}

# 4. Use the accessToken to reach the previously-401 root route
curl -s -H "Authorization: Bearer <accessToken from step 3>" \
  -o /dev/null -w "%{http_code}\n" http://localhost:3001/
# Expected: 200

# 5. Refresh
curl -s -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken from step 3>"}'
# Expected: {"accessToken":"..."} (a new one)

# 6. Wrong password
curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"wrong"}'
# Expected: {"statusCode":401,"message":"이메일 또는 비밀번호가 올바르지 않습니다."}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/joowon/Documents/GitHub/marketing-dashboard
git add server/src/auth/auth.controller.ts server/src/auth/auth.module.ts server/src/app.module.ts
git commit -m "feat: wire AuthController/AuthModule, guard all routes globally by default"
```

---

## Definition of Done for this plan

- [ ] `GET /` (no token) → 401. `GET /health` (no token) → 200.
- [ ] `POST /auth/login` with correct admin credentials → `{ accessToken, refreshToken }`. Wrong password → 401 with `{ statusCode, message }` shape.
- [ ] Access token in `Authorization: Bearer` header unlocks `GET /` (200).
- [ ] `POST /auth/refresh` with a valid refresh token → new `{ accessToken }`. Garbage/expired refresh token → 401.
- [ ] `pnpm test` and `pnpm run test:e2e` still pass (no new tests added this plan, but nothing regressed).
