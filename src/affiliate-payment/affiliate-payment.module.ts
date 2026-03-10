import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffiliatePayment } from 'src/affiliate/entities/affiliate-payment.entity';
import { AffiliateWithdrawalRequest } from 'src/affiliate/entities/affiliate-withdrawal-request.entity';
import { CommissionAuditLog } from 'src/affiliate/entities/commission-audit-log.entity';
import { AffiliatePaymentController } from './affiliate-payment.controller';
import { AffiliatePaymentService } from './affiliate-payment.service';

@Module({
    imports: [TypeOrmModule.forFeature([AffiliatePayment, AffiliateWithdrawalRequest, CommissionAuditLog])],
    controllers: [AffiliatePaymentController],
    providers: [AffiliatePaymentService]
})
export class AffiliatePaymentModule {}
