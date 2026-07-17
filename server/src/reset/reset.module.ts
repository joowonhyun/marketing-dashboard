import { Module } from '@nestjs/common';
import { ResetController } from './reset.controller';
import { ResetService } from './reset.service';

@Module({
  controllers: [ResetController],
  providers: [ResetService],
})
export class ResetModule {}
