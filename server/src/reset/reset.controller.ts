import { Controller, Post } from '@nestjs/common';
import { ResetService } from './reset.service';

// @Public() 없음 — 전역 JwtAuthGuard로 보호되어 관리자 로그인 없이는 호출 불가.
@Controller('admin')
export class ResetController {
  constructor(private readonly resetService: ResetService) {}

  @Post('reset')
  async reset() {
    const result = await this.resetService.reset();
    return { message: '리셋 완료', ...result };
  }
}
