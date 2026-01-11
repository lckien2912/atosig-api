import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { UserSubscription } from '../pricing/entities/user-subscription.entity';
import { PricingModule } from '../pricing/pricing.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([PaymentTransaction, UserSubscription]),
        // Nếu cần dùng SubscriptionService, hãy import module và dùng forwardRef nếu bị vòng lặp
        forwardRef(() => PricingModule)
    ],
    controllers: [PaymentController],
    providers: [PaymentService],
    exports: [PaymentService]
})
export class PaymentModule { }