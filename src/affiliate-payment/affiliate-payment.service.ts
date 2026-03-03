import { BadRequestException, Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import moment from 'moment';
import { AffiliatePayment } from 'src/affiliate/entities/affiliate-payment.entity';
import { AffiliateWithdrawalRequest } from 'src/affiliate/entities/affiliate-withdrawal-request.entity';
import { CommissionAuditLog } from 'src/affiliate/entities/commission-audit-log.entity';
import { User } from 'src/users/entities/user.entity';
import { WithdrawalRequestStatus } from 'src/affiliate/enums/withdrawal-request-status.enum';
import { AuditAction } from 'src/affiliate/enums/audit-action.enum';
import { CreatePaymentBatchDto } from './dto/create-payment-batch.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';

@Injectable()
export class AffiliatePaymentService {
    constructor(
        @InjectRepository(AffiliatePayment)
        private readonly paymentRepo: Repository<AffiliatePayment>,
        @InjectRepository(AffiliateWithdrawalRequest)
        private readonly withdrawalRequestRepo: Repository<AffiliateWithdrawalRequest>,
        @InjectRepository(CommissionAuditLog)
        private readonly auditLogRepo: Repository<CommissionAuditLog>,
        private readonly dataSource: DataSource
    ) {}

    /** Create a payment record, link withdrawal requests to it, and write audit log entries. */
    async createBatch(dto: CreatePaymentBatchDto, adminId: string): Promise<any> {
        return this.dataSource.transaction(async (manager) => {
            // Load & validate requests
            const requests = await manager.find(AffiliateWithdrawalRequest, {
                where: { id: In(dto.withdrawalRequestIds) },
            });

            if (requests.length !== dto.withdrawalRequestIds.length) {
                const foundIds = new Set(requests.map((r) => r.id));
                const missingIds = dto.withdrawalRequestIds.filter((id) => !foundIds.has(id));
                throw new BadRequestException(`Withdrawal requests not found: ${missingIds.join(', ')}`);
            }

            const nonAcceptedRequests = requests.filter((r) => r.status !== WithdrawalRequestStatus.ACCEPTED);
            if (nonAcceptedRequests.length > 0) {
                const ids = nonAcceptedRequests.map((r) => r.id);
                throw new BadRequestException(`Withdrawal requests are not in ACCEPTED status: ${ids.join(', ')}`);
            }

            // Calculate total
            const totalAmount = requests.reduce((sum, r) => sum + Number(r.total_amount), 0);

            // Create payment
            const payment = await manager.save(
                manager.create(AffiliatePayment, {
                    batch_name: dto.batchName ?? `Batch ${moment().format('MM/YYYY')}`,
                    total_amount: totalAmount,
                    payment_date: dto.paymentDate,
                    payment_method: dto.paymentMethod,
                    transaction_id: dto.transactionId,
                    notes: dto.notes,
                    created_by: adminId,
                }),
            );

            // Update each request and create audit log
            for (const request of requests) {
                request.status = WithdrawalRequestStatus.PAID;
                request.payment_id = payment.id;
                request.processed_at = new Date();
                request.processed_by = adminId;
                await manager.save(request);

                await manager.save(
                    manager.create(CommissionAuditLog, {
                        request_id: request.id,
                        affiliate_uid: request.affiliate_uid,
                        action: AuditAction.MARK_PAID,
                        performed_by: adminId,
                        note: `Linked to payment batch "${payment.batch_name}"`,
                    }),
                );
            }

            return { payment, updatedRequestsCount: requests.length };
        });
    }

    /** Attach proof_url (file upload) to an existing payment record. */
    async uploadProof(id: string, file: Express.Multer.File, adminId: string): Promise<{ proofUrl: string }> {
        const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
        const maxSize = 10 * 1024 * 1024; // 10MB

        if (!file) {
            throw new BadRequestException('File is required');
        }
        if (!allowedMimes.includes(file.mimetype)) {
            throw new BadRequestException(`Invalid file type. Allowed: ${allowedMimes.join(', ')}`);
        }
        if (file.size > maxSize) {
            throw new BadRequestException('File size must not exceed 10MB');
        }

        const payment = await this.paymentRepo.findOne({ where: { id } });
        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        const uploadDir = path.join('./uploads/payment-proofs', id);
        fs.mkdirSync(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, file.originalname);
        fs.writeFileSync(filePath, file.buffer);

        const proofUrl = `/uploads/payment-proofs/${id}/${file.originalname}`;
        payment.proof_url = proofUrl;
        await this.paymentRepo.save(payment);

        return { proofUrl };
    }

    /** Paginated list of payments with optional paymentMethod and date range filters. */
    async list(query: ListPaymentsQueryDto): Promise<{ data: any[]; total: number; page: number; size: number }> {
        const qb = this.paymentRepo
            .createQueryBuilder('payment')
            .leftJoin(User, 'creator', 'creator.id = payment.created_by')
            .addSelect('creator.email', 'createdByEmail')
            .addSelect(
                (sub) =>
                    sub
                        .select('COUNT(*)')
                        .from(AffiliateWithdrawalRequest, 'wr')
                        .where('wr.payment_id = payment.id'),
                'requestCount',
            );

        if (query.paymentMethod) {
            qb.andWhere('payment.payment_method = :paymentMethod', { paymentMethod: query.paymentMethod });
        }
        if (query.fromDate) {
            qb.andWhere('payment.payment_date >= :fromDate', { fromDate: query.fromDate });
        }
        if (query.toDate) {
            qb.andWhere('payment.payment_date <= :toDate', { toDate: query.toDate });
        }

        qb.orderBy('payment.created_at', 'DESC');

        const total = await qb.getCount();
        const skip = (query.page - 1) * query.size;

        const raw = await qb.offset(skip).limit(query.size).getRawAndEntities();

        const data = raw.entities.map((payment, i) => ({
            ...payment,
            createdByEmail: raw.raw[i]?.createdByEmail ?? null,
            requestCount: Number(raw.raw[i]?.requestCount ?? 0),
        }));

        return { data, total, page: query.page, size: query.size };
    }

    /** Single payment with all linked withdrawal requests. */
    async getDetail(id: string): Promise<any> {
        const payment = await this.paymentRepo.findOne({ where: { id } });
        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        const [items, creator] = await Promise.all([
            this.withdrawalRequestRepo
                .createQueryBuilder('request')
                .leftJoin(User, 'u', 'u.ref_code = request.affiliate_uid')
                .addSelect('u.email', 'affiliateEmail')
                .addSelect('u.phone_number', 'affiliatePhone')
                .where('request.payment_id = :paymentId', { paymentId: id })
                .getRawAndEntities(),
            payment.created_by
                ? this.dataSource.getRepository(User).findOne({ where: { id: payment.created_by }, select: ['id', 'email'] })
                : null,
        ]);

        return {
            id: payment.id,
            batchName: payment.batch_name,
            totalAmount: payment.total_amount,
            paymentDate: payment.payment_date,
            paymentMethod: payment.payment_method,
            transactionId: payment.transaction_id,
            proofUrl: payment.proof_url,
            notes: payment.notes,
            createdBy: creator ? { id: creator.id, email: creator.email } : null,
            createdAt: payment.created_at,
            items: items.entities.map((req, i) => ({
                requestId: req.id,
                affiliateUid: req.affiliate_uid,
                affiliateEmail: items.raw[i]?.affiliateEmail ?? null,
                affiliatePhone: items.raw[i]?.affiliatePhone ?? null,
                amount: req.total_amount,
            })),
        };
    }
}
