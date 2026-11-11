import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/http-exception.filter';

// 두 케이스 모두 DB 쓰기 전에 거절되므로 테스트 데이터가 남지 않는다.
describe('POST /campaigns plannedCost 검증 (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  const base = {
    name: '테스트 캠페인',
    platform: 'Google',
    status: 'active',
    budget: 10000,
    startDate: '2026-01-01',
    endDate: '2026-01-31',
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // main.ts와 같은 설정
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    token = new JwtService().sign(
      { sub: 'e2e', email: 'e2e@example.com' },
      { secret: process.env.JWT_SECRET, expiresIn: '1m' },
    );
  });

  afterEach(async () => {
    await app.close();
  });

  it('집행 금액이 예산을 넘으면 400', () => {
    return request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...base, plannedCost: 10001 })
      .expect(400)
      .expect((res) => {
        expect((res.body as { message: unknown }).message).toBe(
          '집행 금액은 예산을 초과할 수 없습니다.',
        );
      });
  });

  it('집행 금액이 음수면 400', () => {
    return request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...base, plannedCost: -1 })
      .expect(400)
      .expect((res) => {
        expect(
          JSON.stringify((res.body as { message: unknown }).message),
        ).toContain('집행 금액은 0원 이상');
      });
  });
});
