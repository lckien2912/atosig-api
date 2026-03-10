import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AffiliateWithdrawalRequest } from 'src/affiliate/entities/affiliate-withdrawal-request.entity';
import { AffiliateCommission } from 'src/affiliate/entities/affiliate-commission.entity';
import { CommissionAuditLog } from 'src/affiliate/entities/commission-audit-log.entity';
import { User } from 'src/users/entities/user.entity';
import { WithdrawalRequestStatus } from 'src/affiliate/enums/withdrawal-request-status.enum';
import { WithdrawalStatus } from 'src/affiliate/enums/withdrawal-status.enum';
import { AuditAction } from 'src/affiliate/enums/audit-action.enum';
import { ListWithdrawalRequestsQueryDto, WithdrawalRequestFilterStatus } from './dto/list-withdrawal-requests-query.dto';
import { ProcessWithdrawalRequestDto } from './dto/process-withdrawal-request.dto';
import { BulkActionDto, BulkActionType } from './dto/bulk-action.dto';

@Injectable()
export class AdminCommissionService {
    constructor(
        @InjectRepository(AffiliateWithdrawalRequest)
        private readonly withdrawalRequestRepo: Repository<AffiliateWithdrawalRequest>,
        @InjectRepository(AffiliateCommission)
        private readonly commissionRepo: Repository<AffiliateCommission>,
        @InjectRepository(CommissionAuditLog)
        private readonly auditLogRepo: Repository<CommissionAuditLog>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly dataSource: DataSource
    ) {}

    /** Paginated list of withdrawal requests with status/date/search filters. Joins user for email/phone search. */
    async list(query: ListWithdrawalRequestsQueryDto) {
        const { status, affiliateUid, fromDate, toDate, search, page, size } = query;

        const qb = this.withdrawalRequestRepo
            .createQueryBuilder('req')
            .leftJoin(User, 'affiliateUser', 'affiliateUser.ref_code = req.affiliate_uid')
            .select(['req.*', 'affiliateUser.email AS "affiliateEmail"', 'affiliateUser.phone_number AS "affiliatePhone"']);

        if (status && status !== WithdrawalRequestFilterStatus.ALL) {
            qb.andWhere('req.status = :status', { status });
        }

        if (affiliateUid) {
            qb.andWhere('req.affiliate_uid = :affiliateUid', { affiliateUid });
        }

        if (fromDate) {
            qb.andWhere('req.created_at >= :fromDate', { fromDate });
        }

        if (toDate) {
            qb.andWhere('req.created_at <= :toDate', { toDate });
        }

        if (search) {
            qb.andWhere('(affiliateUser.email ILIKE :search OR affiliateUser.phone_number ILIKE :search)', { search: `%${search}%` });
        }

        const total = await qb.clone().select('COUNT(*)', 'count').getRawOne();

        const data = await qb
            .orderBy('req.created_at', 'DESC')
            .offset((page - 1) * size)
            .limit(size)
            .getRawMany();

        return {
            data: data.map(row => ({
                id: row.id,
                affiliateUid: row.affiliate_uid,
                affiliateEmail: row.affiliateEmail,
                affiliatePhone: row.affiliatePhone,
                totalAmount: row.total_amount,
                status: row.status,
                holdUntil: row.hold_until,
                userNote: row.user_note,
                adminNote: row.admin_note,
                processedBy: row.processed_by,
                processedAt: row.processed_at,
                paymentId: row.payment_id,
                createdAt: row.created_at
            })),
            meta: {
                total: parseInt(total?.count ?? '0', 10),
                totalPages: Math.ceil((parseInt(total?.count ?? '0', 10) || 0) / size),
                page,
                size
            }
        };
    }

    /** Single withdrawal request with associated commissions and audit trail. */
    async getDetail(id: string) {
        const request = await this.withdrawalRequestRepo.findOne({ where: { id } });
        if (!request) {
            throw new NotFoundException('Withdrawal request not found');
        }

        const [affiliateUser, commissionEntries, auditLogs] = await Promise.all([
            this.userRepo.findOne({ where: { ref_code: request.affiliate_uid } }),
            this.commissionRepo.createQueryBuilder('c').select(['c.id', 'c.amount', 'c.level', 'c.status', 'c.source_order_id']).where('c.withdrawal_request_id = :id', { id }).getMany(),
            this.auditLogRepo
                .createQueryBuilder('log')
                .leftJoin(User, 'admin', 'admin.id = log.performed_by')
                .select(['log.action AS "action"', 'admin.email AS "performedByEmail"', 'log.note AS "note"', 'log.created_at AS "createdAt"'])
                .where('log.request_id = :id', { id })
                .orderBy('log.created_at', 'DESC')
                .getRawMany()
        ]);

        return {
            id: request.id,
            affiliateUid: request.affiliate_uid,
            affiliateEmail: affiliateUser?.email ?? null,
            affiliatePhone: affiliateUser?.phone_number ?? null,
            totalAmount: request.total_amount,
            status: request.status,
            holdUntil: request.hold_until,
            userNote: request.user_note,
            adminNote: request.admin_note,
            processedBy: request.processed_by,
            processedAt: request.processed_at,
            paymentId: request.payment_id,
            createdAt: request.created_at,
            commissionEntries: commissionEntries.map(c => ({
                id: c.id,
                amount: c.amount,
                level: c.level,
                status: c.status,
                sourceOrderId: c.source_order_id
            })),
            auditLogs
        };
    }

    /** Transition PENDING → ACCEPTED, create audit log entry. */
    async approve(id: string, dto: ProcessWithdrawalRequestDto, adminId: string) {
        const request = await this.withdrawalRequestRepo.findOne({ where: { id } });
        if (!request) throw new NotFoundException('Withdrawal request not found');

        if (request.status !== WithdrawalRequestStatus.PENDING) {
            throw new BadRequestException('Status must be PENDING');
        }

        if (request.hold_until && request.hold_until > new Date()) {
            throw new BadRequestException(`Request is currently on hold until ${request.hold_until.toISOString()}`);
        }

        request.status = WithdrawalRequestStatus.ACCEPTED;
        request.admin_note = dto.adminNote ?? null;
        request.processed_by = adminId;
        request.processed_at = new Date();
        await this.withdrawalRequestRepo.save(request);

        await this.auditLogRepo.save(
            this.auditLogRepo.create({
                request_id: id,
                affiliate_uid: request.affiliate_uid,
                action: AuditAction.APPROVE,
                performed_by: adminId,
                note: dto.adminNote ?? null
            })
        );
    }

    /** Transition PENDING → REJECTED, revert commissions to AVAILABLE, create audit log entry. */
    async reject(id: string, dto: ProcessWithdrawalRequestDto, adminId: string) {
        const request = await this.withdrawalRequestRepo.findOne({ where: { id } });
        if (!request) throw new NotFoundException('Withdrawal request not found');

        if (request.status !== WithdrawalRequestStatus.PENDING) {
            throw new BadRequestException('Status must be PENDING');
        }

        if (!dto.adminNote?.trim()) {
            throw new BadRequestException('Reason is required');
        }

        request.status = WithdrawalRequestStatus.REJECTED;
        request.admin_note = dto.adminNote;
        request.processed_by = adminId;
        request.processed_at = new Date();
        await this.withdrawalRequestRepo.save(request);

        await this.commissionRepo
            .createQueryBuilder()
            .update(AffiliateCommission)
            .set({ status: WithdrawalStatus.AVAILABLE, withdrawal_request_id: null })
            .where('withdrawal_request_id = :id', { id })
            .execute();

        await this.auditLogRepo.save(
            this.auditLogRepo.create({
                request_id: id,
                affiliate_uid: request.affiliate_uid,
                action: AuditAction.REJECT,
                performed_by: adminId,
                note: dto.adminNote
            })
        );
    }

    /** Transition PENDING → HOLD with optional holdUntil date, create audit log entry. */
    async hold(id: string, dto: ProcessWithdrawalRequestDto, adminId: string) {
        const request = await this.withdrawalRequestRepo.findOne({ where: { id } });
        if (!request) throw new NotFoundException('Withdrawal request not found');

        if (request.status !== WithdrawalRequestStatus.PENDING) {
            throw new BadRequestException('Status must be PENDING');
        }

        if (!dto.adminNote?.trim()) {
            throw new BadRequestException('Reason is required');
        }

        const holdUntil = dto.holdUntil ? new Date(dto.holdUntil) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        request.hold_until = holdUntil;
        request.admin_note = dto.adminNote;
        await this.withdrawalRequestRepo.save(request);

        await this.auditLogRepo.save(
            this.auditLogRepo.create({
                request_id: id,
                affiliate_uid: request.affiliate_uid,
                action: AuditAction.HOLD,
                performed_by: adminId,
                note: dto.adminNote
            })
        );
    }

    /** Release hold → clear holdUntil, create audit log entry. */
    async releaseHold(id: string, adminId: string) {
        const request = await this.withdrawalRequestRepo.findOne({ where: { id } });
        if (!request) throw new NotFoundException('Withdrawal request not found');

        if (request.status !== WithdrawalRequestStatus.PENDING || !request.hold_until) {
            throw new BadRequestException('Request is not on hold');
        }

        request.hold_until = null;
        request.admin_note = null;
        await this.withdrawalRequestRepo.save(request);

        await this.auditLogRepo.save(
            this.auditLogRepo.create({
                request_id: id,
                affiliate_uid: request.affiliate_uid,
                action: AuditAction.RELEASE,
                performed_by: adminId
            })
        );
    }

    /** Transition REJECTED → PENDING, create audit log entry. */
    async revert(id: string, adminId: string) {
        const request = await this.withdrawalRequestRepo.findOne({ where: { id } });
        if (!request) throw new NotFoundException('Withdrawal request not found');

        if (request.status !== WithdrawalRequestStatus.REJECTED) {
            throw new BadRequestException('Status must be REJECTED');
        }

        request.status = WithdrawalRequestStatus.PENDING;
        request.admin_note = null;
        request.processed_by = null;
        request.processed_at = null;
        await this.withdrawalRequestRepo.save(request);

        await this.auditLogRepo.save(
            this.auditLogRepo.create({
                request_id: id,
                affiliate_uid: request.affiliate_uid,
                action: AuditAction.REVERT,
                performed_by: adminId
            })
        );
    }

    /** Batch approve/reject/hold, returns success/failure counts. */
    async bulkAction(dto: BulkActionDto, adminId: string) {
        const success: string[] = [];
        const failed: { id: string; reason: string }[] = [];

        await this.dataSource.transaction(async manager => {
            const requests = await manager.find(AffiliateWithdrawalRequest, { where: { id: In(dto.ids) } });
            const requestMap = new Map(requests.map(r => [r.id, r]));

            for (const id of dto.ids) {
                const request = requestMap.get(id);
                if (!request) {
                    failed.push({ id, reason: 'Not found' });
                    continue;
                }

                if (request.status !== WithdrawalRequestStatus.PENDING) {
                    failed.push({ id, reason: 'Status is not PENDING' });
                    continue;
                }

                try {
                    const actionDto: ProcessWithdrawalRequestDto = { adminNote: dto.reason };

                    if (dto.action === BulkActionType.APPROVE) {
                        if (request.hold_until && request.hold_until > new Date()) {
                            failed.push({ id, reason: `Request is currently on hold until ${request.hold_until.toISOString()}` });
                            continue;
                        }

                        request.status = WithdrawalRequestStatus.ACCEPTED;
                        request.admin_note = actionDto.adminNote ?? null;
                        request.processed_by = adminId;
                        request.processed_at = new Date();
                        await manager.save(request);

                        await manager.save(
                            CommissionAuditLog,
                            manager.create(CommissionAuditLog, {
                                request_id: id,
                                affiliate_uid: request.affiliate_uid,
                                action: AuditAction.APPROVE,
                                performed_by: adminId,
                                note: actionDto.adminNote ?? null
                            })
                        );
                    } else if (dto.action === BulkActionType.REJECT) {
                        request.status = WithdrawalRequestStatus.REJECTED;
                        request.admin_note = actionDto.adminNote ?? null;
                        request.processed_by = adminId;
                        request.processed_at = new Date();
                        await manager.save(request);

                        await manager
                            .createQueryBuilder()
                            .update(AffiliateCommission)
                            .set({ status: WithdrawalStatus.AVAILABLE, withdrawal_request_id: null })
                            .where('withdrawal_request_id = :id', { id })
                            .execute();

                        await manager.save(
                            CommissionAuditLog,
                            manager.create(CommissionAuditLog, {
                                request_id: id,
                                affiliate_uid: request.affiliate_uid,
                                action: AuditAction.REJECT,
                                performed_by: adminId,
                                note: actionDto.adminNote ?? null
                            })
                        );
                    } else if (dto.action === BulkActionType.HOLD) {
                        const holdUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                        request.hold_until = holdUntil;
                        request.admin_note = actionDto.adminNote ?? null;
                        await manager.save(request);

                        await manager.save(
                            CommissionAuditLog,
                            manager.create(CommissionAuditLog, {
                                request_id: id,
                                affiliate_uid: request.affiliate_uid,
                                action: AuditAction.HOLD,
                                performed_by: adminId,
                                note: actionDto.adminNote ?? null
                            })
                        );
                    }

                    success.push(id);
                } catch (err) {
                    failed.push({ id, reason: err instanceof Error ? err.message : 'Unknown error' });
                }
            }
        });

        return { success, failed };
    }
}
