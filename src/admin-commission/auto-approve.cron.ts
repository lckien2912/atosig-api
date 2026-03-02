import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { AffiliateWithdrawalRequest } from 'src/affiliate/entities/affiliate-withdrawal-request.entity';
import { CommissionAuditLog } from 'src/affiliate/entities/commission-audit-log.entity';
import { WithdrawalRequestStatus } from 'src/affiliate/enums/withdrawal-request-status.enum';
import { AuditAction } from 'src/affiliate/enums/audit-action.enum';

@Injectable()
export class AutoApproveCron {
    private readonly logger = new Logger('AutoApproveCron');

    constructor(
        @InjectRepository(AffiliateWithdrawalRequest)
        private readonly withdrawalRequestRepo: Repository<AffiliateWithdrawalRequest>,
        private readonly dataSource: DataSource
    ) {}

    @Cron('0 */6 * * *')
    async handleAutoApprove() {
        try {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            const requests = await this.withdrawalRequestRepo.find({
                where: {
                    status: WithdrawalRequestStatus.PENDING,
                    hold_until: IsNull(),
                    created_at: LessThanOrEqual(sevenDaysAgo)
                }
            });

            if (requests.length === 0) return;

            const chunkSize = 50;
            let total = 0;

            for (let i = 0; i < requests.length; i += chunkSize) {
                const chunk = requests.slice(i, i + chunkSize);

                await this.dataSource.transaction(async manager => {
                    for (const request of chunk) {
                        request.status = WithdrawalRequestStatus.ACCEPTED;
                        request.processed_at = new Date();
                        request.processed_by = null;
                        await manager.save(request);

                        await manager.save(
                            CommissionAuditLog,
                            manager.create(CommissionAuditLog, {
                                request_id: request.id,
                                affiliate_uid: request.affiliate_uid,
                                action: AuditAction.AUTO_APPROVE,
                                performed_by: null,
                                note: 'Auto-approved after 7-day hold period'
                            })
                        );
                    }
                });

                total += chunk.length;
            }

            this.logger.log(`Auto-approved ${total} withdrawal requests`);
        } catch (error) {
            this.logger.error(
                error instanceof Error ? error.message : 'Unknown error',
                error instanceof Error ? error.stack : undefined
            );
        }
    }
}
