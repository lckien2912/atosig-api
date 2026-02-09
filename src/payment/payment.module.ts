import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { UserSubscription } from '../pricing/entities/user-subscription.entity';
import { User } from '../users/entities/user.entity';
import { PricingModule } from '../pricing/pricing.module';
import { NotificationsModule } from 'src/notification/notifications.module';
import { AffiliateModule } from 'src/affiliate/affiliate.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([PaymentTransaction, UserSubscription, User]),
        NotificationsModule,
        AffiliateModule,
        // Nếu cần dùng SubscriptionService, hãy import module và dùng forwardRef nếu bị vòng lặp
        forwardRef(() => PricingModule)
    ],
    controllers: [PaymentController],
    providers: [PaymentService],
    exports: [PaymentService]
})
export class PaymentModule { }