import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AffiliateService } from './affiliate.service';
import { AffiliateController } from './affiliate.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000, // 10 seconds timeout
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  controllers: [AffiliateController],
  providers: [AffiliateService],
  exports: [AffiliateService], // Export để các module khác có thể sử dụng
})
export class AffiliateModule {}
