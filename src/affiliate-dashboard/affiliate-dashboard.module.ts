import { Module } from '@nestjs/common';
import { AffiliateDashboardController } from './affiliate-dashboard.controller';
import { AffiliateDashboardService } from './affiliate-dashboard.service';

@Module({
    controllers: [AffiliateDashboardController],
    providers: [AffiliateDashboardService],
})
export class AffiliateDashboardModule {}
