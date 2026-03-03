import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { AffiliateWithdrawalRequest } from 'src/affiliate/entities/affiliate-withdrawal-request.entity';
import { CommissionAuditLog } from 'src/affiliate/entities/commission-audit-log.entity';
import { AdminAffiliateController } from './admin-affiliate.controller';
import { AdminAffiliateService } from './admin-affiliate.service';

@Module({
    imports: [TypeOrmModule.forFeature([User, AffiliateWithdrawalRequest, CommissionAuditLog])],
    controllers: [AdminAffiliateController],
    providers: [AdminAffiliateService],
})
export class AdminAffiliateModule {}
