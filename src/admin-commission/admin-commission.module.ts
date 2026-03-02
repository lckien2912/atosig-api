import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffiliateWithdrawalRequest } from 'src/affiliate/entities/affiliate-withdrawal-request.entity';
import { AffiliateCommission } from 'src/affiliate/entities/affiliate-commission.entity';
import { CommissionAuditLog } from 'src/affiliate/entities/commission-audit-log.entity';
import { User } from 'src/users/entities/user.entity';
import { AdminCommissionController } from './admin-commission.controller';
import { AdminCommissionService } from './admin-commission.service';
import { AutoApproveCron } from './auto-approve.cron';

@Module({
    imports: [TypeOrmModule.forFeature([AffiliateWithdrawalRequest, AffiliateCommission, CommissionAuditLog, User])],
    controllers: [AdminCommissionController],
    providers: [AdminCommissionService, AutoApproveCron]
})
export class AdminCommissionModule {}
