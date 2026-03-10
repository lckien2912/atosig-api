import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { AffiliateWithdrawalRequest } from 'src/affiliate/entities/affiliate-withdrawal-request.entity';
import { CommissionAuditLog } from 'src/affiliate/entities/commission-audit-log.entity';
import { AuditAction } from 'src/affiliate/enums/audit-action.enum';
import { WithdrawalRequestStatus } from 'src/affiliate/enums/withdrawal-request-status.enum';
import { WithdrawalStatus } from 'src/affiliate/enums/withdrawal-status.enum';
import { AffiliateStatus } from 'src/users/enums/user-status.enum';
import { ListAffiliatesQueryDto } from './dto';

@Injectable()
export class AdminAffiliateService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(AffiliateWithdrawalRequest)
        private readonly withdrawalRepo: Repository<AffiliateWithdrawalRequest>,
        @InjectRepository(CommissionAuditLog)
        private readonly auditLogRepo: Repository<CommissionAuditLog>
    ) {}

    private buildAffiliateMetricsQuery(): SelectQueryBuilder<User> {
        return this.userRepo
            .createQueryBuilder('user')
            .select([
                'user.id AS id',
                'user.full_name AS "fullName"',
                'user.email AS email',
                'user.phone_number AS "phoneNumber"',
                'user.ref_code AS "refCode"',
                'user.affiliate_status AS "affiliateStatus"',
                'user.affiliate_tier AS "affiliateTier"',
                'user.created_at AS "createdAt"'
            ])
            .addSelect(`(SELECT COUNT(*) FROM users WHERE ref_from = user.ref_code)`, 'totalInvitees')
            .addSelect(`(SELECT COALESCE(SUM(amount), 0) FROM affiliate_commissions WHERE affiliate_uid = user.ref_code)`, 'totalCommissionEarned')
            .addSelect(`(SELECT COALESCE(SUM(total_amount), 0) FROM affiliate_withdrawal_requests WHERE affiliate_uid = user.ref_code AND status = '${WithdrawalRequestStatus.PAID}')`, 'totalPaid')
            .addSelect(
                `(SELECT COALESCE(SUM(total_amount), 0) FROM affiliate_withdrawal_requests WHERE affiliate_uid = user.ref_code AND status = '${WithdrawalRequestStatus.ACCEPTED}')`,
                'pendingPayment'
            )
            .addSelect(`(SELECT COALESCE(SUM(amount), 0) FROM affiliate_commissions WHERE affiliate_uid = user.ref_code AND status = '${WithdrawalStatus.AVAILABLE}')`, 'availableToWithdraw');
    }

    private castMetricsRow(row: Record<string, any>) {
        return {
            ...row,
            totalInvitees: Number(row.totalInvitees),
            totalCommissionEarned: Number(row.totalCommissionEarned),
            totalPaid: Number(row.totalPaid),
            pendingPayment: Number(row.pendingPayment),
            availableToWithdraw: Number(row.availableToWithdraw)
        };
    }

    async list(query: ListAffiliatesQueryDto) {
        const { status, search, tier, page, size } = query;
        const skip = (page - 1) * size;

        const qb = this.buildAffiliateMetricsQuery().where('user.ref_code IS NOT NULL');

        if (status && status !== 'ALL') {
            qb.andWhere('user.affiliate_status = :status', { status });
        }

        if (tier) {
            qb.andWhere('user.affiliate_tier = :tier', { tier });
        }

        if (search) {
            qb.andWhere('(user.email ILIKE :search OR user.phone_number ILIKE :search OR user.ref_code ILIKE :search)', { search: `%${search}%` });
        }

        const total = await qb.getCount();

        const data = await qb.orderBy('user.created_at', 'DESC').offset(skip).limit(size).getRawMany();

        return {
            data: data.map(row => this.castMetricsRow(row)),
            meta: {
                total,
                page,
                size,
                totalPages: Math.ceil(total / size) || 1
            }
        };
    }

    async getDetail(uid: string) {
        const [metrics, recentRequests, statusLogs] = await Promise.all([
            this.buildAffiliateMetricsQuery().where('user.ref_code = :uid', { uid }).getRawOne(),
            this.withdrawalRepo.find({
                where: { affiliate_uid: uid },
                order: { created_at: 'DESC' },
                take: 10
            }),
            this.getStatusLogs(uid, 10)
        ]);

        if (!metrics) {
            throw new NotFoundException('Affiliate not found');
        }

        return {
            ...this.castMetricsRow(metrics),
            recentRequests,
            statusLogs
        };
    }

    async changeStatus(uid: string, newStatus: AffiliateStatus, reason: string, adminId: string) {
        const user = await this.userRepo.findOne({ where: { ref_code: uid } });
        if (!user) {
            throw new NotFoundException('Affiliate not found');
        }

        if (user.affiliate_status === newStatus) {
            throw new BadRequestException('Affiliate already has this status');
        }

        user.affiliate_status = newStatus;
        await this.userRepo.save(user);

        await this.auditLogRepo.save(
            this.auditLogRepo.create({
                action: AuditAction.STATUS_CHANGE,
                affiliate_uid: uid,
                performed_by: adminId,
                note: reason
            })
        );

        return { message: 'Status updated successfully' };
    }

    async getStatusLogs(uid: string, limit?: number) {
        const qb = this.auditLogRepo
            .createQueryBuilder('log')
            .leftJoin('users', 'admin', 'admin.id = log.performed_by')
            .select(['log.id AS id', 'log.action AS action', 'log.note AS note', 'log.created_at AS "createdAt"', 'admin.email AS "performedByEmail"'])
            .where('log.affiliate_uid = :uid', { uid })
            .andWhere('log.action = :action', { action: AuditAction.STATUS_CHANGE })
            .orderBy('log.created_at', 'DESC');

        if (limit) {
            qb.limit(limit);
        }

        return qb.getRawMany();
    }
}
