import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffiliateService } from './affiliate.service';
import { AffiliateController } from './affiliate.controller';
import { User } from '../users/entities/user.entity';
import { AffiliateWithdrawal } from './entities/affiliate-withdrawal.entity';
import { AffiliateWithdrawalRequest } from './entities/affiliate-withdrawal-request.entity';
import { UserSubscription } from '../pricing/entities/user-subscription.entity';
import { SubscriptionPlan } from '../pricing/entities/subscription-plan.entity';

@Module({
    imports: [
        HttpModule.register({
            timeout: 10000, // 10 seconds timeout
            maxRedirects: 5
        }),
        ConfigModule,
        TypeOrmModule.forFeature([User, AffiliateWithdrawal, AffiliateWithdrawalRequest, UserSubscription, SubscriptionPlan])
    ],
    controllers: [AffiliateController],
    providers: [AffiliateService],
    exports: [AffiliateService] // Export để các module khác có thể sử dụng
})
export class AffiliateModule {}
