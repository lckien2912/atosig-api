import { Injectable, Logger, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AxiosError, AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
    CreateAffiliateUserDto,
    CreateAffiliateOrderDto,
    AffiliateUserOverviewDto,
    AffiliateInviteeDto,
    AffiliateCommissionDto,
    AffiliateResponseDto,
    GetInviteesQueryDto,
    GetCommissionsQueryDto,
    GetWithdrawalsQueryDto,
    ProcessWithdrawalDto,
    CreateWithdrawalRequestDto,
    CreateOrderResponseDto
} from './dto';
import { AffiliateErrorCode } from './enums/affiliate-error-code.enum';
import { WithdrawalStatus } from './enums/withdrawal-status.enum';
import { WithdrawalRequestStatus } from './enums/withdrawal-request-status.enum';
import { handleAffiliateError, handleAxiosError } from './helpers/affiliate-error-handler';
import { User } from '../users/entities/user.entity';
import { AffiliateCommission } from './entities/affiliate-commission.entity';
import { AffiliateWithdrawalRequest } from './entities/affiliate-withdrawal-request.entity';
import { UserSubscription } from '../pricing/entities/user-subscription.entity';
import { SubscriptionStatus } from '../pricing/enums/pricing.enum';

@Injectable()
export class AffiliateService {
    private readonly logger = new Logger(AffiliateService.name);
    private readonly baseUrl: string;
    private readonly apiKey: string;
    private readonly defaultPercent: number;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(AffiliateCommission)
        private readonly commissionRepository: Repository<AffiliateCommission>,
        @InjectRepository(AffiliateWithdrawalRequest)
        private readonly withdrawalRequestRepository: Repository<AffiliateWithdrawalRequest>,
        @InjectRepository(UserSubscription)
        private readonly subscriptionRepository: Repository<UserSubscription>
    ) {
        this.baseUrl = this.configService.get<string>('AFFILIATE_SERVICE_URL') || 'http://localhost:8080';
        this.apiKey = this.configService.get<string>('AFFILIATE_API_KEY') || '';
        this.defaultPercent = this.configService.get<number>('AFFILIATE_DEFAULT_PERCENT') || 10;
    }

    private getHeaders() {
        return {
            'Content-Type': 'application/json',
            'X-API-KEY': this.apiKey
        };
    }

    /**
     * Tạo user affiliate khi user đăng ký vào hệ thống
     * @param uid - User ID từ PostgreSQL
     * @param refUid - Referrer user ID (optional)
     * @param email - Email của user
     * @param percent - Commission percent (optional, default từ config)
     */
    async createAffiliateUser(uid: string, refUid?: string, email?: string, percent?: number): Promise<AffiliateResponseDto<any>> {
        try {
            const dto: CreateAffiliateUserDto = {
                uid,
                refUid: refUid,
                email: email || undefined,
                percent: percent ?? this.defaultPercent
            };

            if (refUid) {
                const refUser = await this.getUserOverview(refUid);
                if (!refUser) dto.refUid = undefined;
            }

            const response: AxiosResponse<AffiliateResponseDto<any>> = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/api/v1/users`, dto, {
                    headers: this.getHeaders()
                })
            );

            const responseData = response.data;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
            if (responseData.code !== AffiliateErrorCode.SUCCESS) {
                handleAffiliateError(responseData.code as AffiliateErrorCode, responseData.message);
            }

            this.logger.log(`Created affiliate user: ${uid}`);
            return responseData;
        } catch (error) {
            this.logger.error(`Failed to create affiliate user: ${uid}`, error instanceof Error ? error.message : String(error));
            if (error instanceof AxiosError) {
                handleAxiosError(error);
            }
            // Re-throw if it's already a NestJS exception
            if (error instanceof Error && !(error instanceof AxiosError)) {
                throw error;
            }
            throw error;
        }
    }

    /**
     * Tạo đơn hàng affiliate để tính commission cho referrer
     * Được gọi sau khi payment thành công
     */
    async createOrder(uid: string, orderId: string, orderName: string, orderPayPrice: number, orderActuallyPaid: number): Promise<AffiliateResponseDto<CreateOrderResponseDto>> {
        try {
            const dto: CreateAffiliateOrderDto = {
                uid,
                orderId,
                orderName,
                orderPayPrice,
                orderActuallyPaid
            };

            const response: AxiosResponse<AffiliateResponseDto<CreateOrderResponseDto>> = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/api/v1/orders`, dto, {
                    headers: this.getHeaders()
                })
            );

            const responseData = response.data;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
            if (responseData.code !== AffiliateErrorCode.SUCCESS) {
                handleAffiliateError(responseData.code as AffiliateErrorCode, responseData.message);
            }

            this.logger.log(`Created affiliate order: ${orderId} for user: ${uid}`);

            // Create local commission entries for ALL ancestor levels using the external service response
            try {
                const commissions = responseData.data?.commissions ?? [];
                if (commissions.length > 0) {
                    // Idempotency: find existing entries for this order
                    const existingEntries = await this.commissionRepository.find({
                        where: { source_order_id: orderId },
                        select: ['affiliate_uid']
                    });
                    const existingUids = new Set(existingEntries.map(e => e.affiliate_uid));

                    const newEntries = commissions
                        .filter(c => c.amount > 0 && !existingUids.has(c.uid))
                        .map(c =>
                            this.commissionRepository.create({
                                affiliate_uid: c.uid,
                                amount: c.amount,
                                status: WithdrawalStatus.AVAILABLE,
                                source_order_id: orderId,
                                level: c.level
                            })
                        );

                    if (newEntries.length > 0) {
                        await this.commissionRepository.save(newEntries);
                        this.logger.log(`Created ${newEntries.length} commission entries for order: ${orderId} — ` + newEntries.map(e => `${e.affiliate_uid} (L${e.level}): ${e.amount}`).join(', '));
                    }
                }
            } catch (commissionError) {
                this.logger.error(`Failed to create local commission entries for order: ${orderId}`, commissionError instanceof Error ? commissionError.message : String(commissionError));
            }

            return responseData;
        } catch (error) {
            this.logger.error(`Failed to create affiliate order: ${orderId}`, error instanceof Error ? error.message : String(error));
            if (error instanceof AxiosError) {
                handleAxiosError(error);
            }
            // Re-throw if it's already a NestJS exception
            if (error instanceof Error && !(error instanceof AxiosError)) {
                throw error;
            }
            throw error;
        }
    }

    /**
     * Lấy thông tin tổng quan affiliate của user
     */
    async getUserOverview(uid: string) {
        try {
            const response: AxiosResponse<AffiliateResponseDto<AffiliateUserOverviewDto>> = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/api/v1/users/overview/${uid}`, {
                    headers: this.getHeaders()
                })
            );

            const responseData = response.data;

            // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
            if (responseData.code !== AffiliateErrorCode.SUCCESS) {
                handleAffiliateError(responseData.code as AffiliateErrorCode, responseData.message);
            }

            const overviewData = responseData.data;

            const [available, withdrawn] = await Promise.all([
                this.commissionRepository
                    .createQueryBuilder('w')
                    .select('SUM(w.amount)', 'total')
                    .where('w.affiliate_uid = :uid AND w.status = :status', { uid, status: WithdrawalStatus.AVAILABLE })
                    .getRawOne(),
                this.commissionRepository
                    .createQueryBuilder('w')
                    .select('SUM(w.amount)', 'total')
                    .innerJoin('w.withdrawal_request', 'r', 'r.status = :reqStatus', { reqStatus: WithdrawalRequestStatus.ACCEPTED })
                    .where('w.affiliate_uid = :uid AND w.status = :status', { uid, status: WithdrawalStatus.WITHDRAWN })
                    .getRawOne()
            ]);

            return {
                ...overviewData,
                totalWithdrawn: Number(withdrawn?.total ?? 0),
                availableToWithdraw: Number(available?.total ?? 0)
            };
        } catch (error) {
            this.logger.error(`Failed to get affiliate overview for user: ${uid}`, error instanceof Error ? error.message : String(error));
            if (error instanceof AxiosError) {
                handleAxiosError(error);
            }
            // Re-throw if it's already a NestJS exception
            if (error instanceof Error && !(error instanceof AxiosError)) {
                throw error;
            }
            throw error;
        }
    }

    async getUserInvitees(uid: string, query: GetInviteesQueryDto) {
        try {
            // Nếu không truyền ngày, set mặc định từ đầu năm 2026 đến ngày hiện tại + 1 ngày
            if (!query.fromDate && !query.toDate) {
                const defaultFromDate = new Date('2026-01-01');
                const defaultToDate = new Date();
                defaultToDate.setDate(defaultToDate.getDate() + 1);
                query.fromDate = defaultFromDate.toISOString().split('T')[0];
                query.toDate = defaultToDate.toISOString().split('T')[0];
            }

            const { search, page = 1, size = 10, level, fromDate, toDate } = query;

            const packageFilter = query['package'];
            const useLocalFilter = !!(search || packageFilter);

            const externalParams: Record<string, any> = { level, fromDate, toDate };

            let invitees: AffiliateInviteeDto[];
            let total: number;
            let responsePage: number;
            let responseSize: number;

            if (useLocalFilter) {
                // Path A: fetch all (up to 1000) for local filtering
                externalParams.page = 1;
                externalParams.size = 1000;

                const response: AxiosResponse<AffiliateResponseDto<AffiliateInviteeDto[]>> = await firstValueFrom(
                    this.httpService.get(`${this.baseUrl}/api/v1/users/invitees/${uid}`, {
                        headers: this.getHeaders(),
                        params: externalParams
                    })
                );

                const responseData = response.data;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
                if (responseData.code !== AffiliateErrorCode.SUCCESS) {
                    handleAffiliateError(responseData.code as AffiliateErrorCode, responseData.message);
                }

                const allInvitees = responseData.data || [];
                const uids = allInvitees.map(i => i.uid);
                const users = uids.length > 0 ? await this.userRepository.find({ where: { ref_code: In(uids) }, select: ['id', 'ref_code', 'email', 'phone_number', 'subscription_tier'] }) : [];
                const userMap = new Map(users.map(u => [u.ref_code, u]));

                const userIds = users.map(u => u.id);
                const subscriptions =
                    userIds.length > 0
                        ? await this.subscriptionRepository.find({
                              where: { user_id: In(userIds), status: SubscriptionStatus.ACTIVE },
                              relations: ['plan']
                          })
                        : [];
                const subMap = new Map(subscriptions.map(s => [s.user_id, s]));

                // Apply local filters
                let filtered = allInvitees.map(i => {
                    const user = userMap.get(i.uid);
                    const sub = user ? subMap.get(user.id) : null;
                    return { invitee: i, user, sub };
                });

                if (search) {
                    const term = search.toLowerCase();
                    filtered = filtered.filter(({ invitee, user }) => {
                        const codeMatch = invitee.uid?.toLowerCase().includes(term);
                        const emailMatch = user?.email?.toLowerCase().includes(term);
                        const phoneMatch = user?.phone_number?.toLowerCase().includes(term);
                        return codeMatch || emailMatch || phoneMatch;
                    });
                }

                if (packageFilter) {
                    filtered = filtered.filter(({ sub }) => sub?.plan?.name === packageFilter);
                }

                total = filtered.length;
                const skip = (page - 1) * size;
                const pageSlice = filtered.slice(skip, skip + size);

                invitees = pageSlice.map(({ invitee, user, sub }) => ({
                    ...invitee,
                    email: user?.email ?? null,
                    phone: user?.phone_number ?? null,
                    package: sub?.plan?.name ?? null
                }));

                responsePage = page;
                responseSize = size;
            } else {
                // Path B: delegate pagination entirely to external service; map search → keyword
                if (search) externalParams.keyword = search;
                externalParams.page = page;
                externalParams.size = size;

                const response: AxiosResponse<AffiliateResponseDto<AffiliateInviteeDto[]>> = await firstValueFrom(
                    this.httpService.get(`${this.baseUrl}/api/v1/users/invitees/${uid}`, {
                        headers: this.getHeaders(),
                        params: externalParams
                    })
                );

                const responseData = response.data;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
                if (responseData.code !== AffiliateErrorCode.SUCCESS) {
                    handleAffiliateError(responseData.code as AffiliateErrorCode, responseData.message);
                }

                total = responseData.pagination?.total || 0;
                responsePage = responseData.pagination?.current || 1;
                responseSize = responseData.pagination?.size || size;

                const rawInvitees = responseData.data || [];
                const uids = rawInvitees.map(i => i.uid);
                const users = uids.length > 0 ? await this.userRepository.find({ where: { ref_code: In(uids) }, select: ['id', 'ref_code', 'email', 'phone_number', 'subscription_tier'] }) : [];
                const userMap = new Map(users.map(u => [u.ref_code, u]));

                const userIds = users.map(u => u.id);
                const subscriptions =
                    userIds.length > 0
                        ? await this.subscriptionRepository.find({
                              where: { user_id: In(userIds), status: SubscriptionStatus.ACTIVE },
                              relations: ['plan']
                          })
                        : [];
                const subMap = new Map(subscriptions.map(s => [s.user_id, s]));

                invitees = rawInvitees.map(i => {
                    const user = userMap.get(i.uid);
                    const sub = user ? subMap.get(user.id) : null;
                    return {
                        ...i,
                        email: user?.email ?? null,
                        phone: user?.phone_number ?? null,
                        package: sub?.plan?.name ?? null
                    };
                });
            }

            const totalPages = Math.ceil(total / responseSize);

            return {
                data: invitees,
                meta: {
                    total,
                    page: Number(responsePage),
                    limit: Number(responseSize),
                    totalPages: Number(totalPages)
                }
            };
        } catch (error) {
            this.logger.error(`Failed to get invitees for user: ${uid}`, error instanceof Error ? error.message : String(error));
            if (error instanceof AxiosError) {
                handleAxiosError(error);
            }
            // Re-throw if it's already a NestJS exception
            if (error instanceof Error && !(error instanceof AxiosError)) {
                throw error;
            }
            throw error;
        }
    }

    /**
     * Lấy lịch sử commission của user
     */
    async getUserCommissions(uid: string, query: GetCommissionsQueryDto) {
        try {
            // Nếu không truyền ngày, set mặc định từ đầu năm 2026 đến ngày hiện tại + 1 ngày
            if (!query.fromDate && !query.toDate) {
                const defaultFromDate = new Date('2026-01-01');
                const defaultToDate = new Date();
                defaultToDate.setDate(defaultToDate.getDate() + 1);
                query.fromDate = defaultFromDate.toISOString().split('T')[0];
                query.toDate = defaultToDate.toISOString().split('T')[0];
            }

            const response: AxiosResponse<AffiliateResponseDto<AffiliateCommissionDto[]>> = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/api/v1/users/commissions/${uid}`, {
                    headers: this.getHeaders(),
                    params: query
                })
            );

            const responseData = response.data;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
            if (responseData.code !== AffiliateErrorCode.SUCCESS) {
                handleAffiliateError(responseData.code as AffiliateErrorCode, responseData.message);
            }

            const total = responseData.pagination?.total || 0;
            const page = responseData.pagination?.current || 1;
            const limit = responseData.pagination?.size || 0;
            const totalPages = Math.ceil(total / limit);

            return {
                data: responseData.data,
                meta: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Number(totalPages)
                }
            };
        } catch (error) {
            this.logger.error(`Failed to get commissions for user: ${uid}`, error instanceof Error ? error.message : String(error));
            if (error instanceof AxiosError) {
                handleAxiosError(error);
            }
            // Re-throw if it's already a NestJS exception
            if (error instanceof Error && !(error instanceof AxiosError)) {
                throw error;
            }
            throw error;
        }
    }

    /**
     * Cập nhật commission rate của user (chỉ được cập nhật direct invitee)
     */
    async updateRate(sourceUid: string, targetUid: string, rate: number): Promise<AffiliateResponseDto<any>> {
        try {
            const targetOverview = await this.getUserOverview(targetUid);
            if (targetOverview?.refUid !== sourceUid) {
                throw new ForbiddenException('You can only update the rate of your direct invitees');
            }

            const response: AxiosResponse<AffiliateResponseDto<any>> = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/api/v1/users/update-rate`, { sourceUid, targetUid, rate }, { headers: this.getHeaders() })
            );
            this.logger.log(response.data);

            const responseData = response.data;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
            if (responseData.code !== AffiliateErrorCode.SUCCESS) {
                handleAffiliateError(responseData.code as AffiliateErrorCode, responseData.message);
            }

            this.logger.log(`Updated rate for user: ${targetUid} to ${rate}%`);
            return responseData;
        } catch (error) {
            this.logger.error(`Failed to update rate for user: ${targetUid}`, error instanceof Error ? error.message : String(error));
            if (error instanceof AxiosError) {
                handleAxiosError(error);
            }
            // Re-throw if it's already a NestJS exception
            if (error instanceof Error && !(error instanceof AxiosError)) {
                throw error;
            }
            throw error;
        }
    }

    /**
     * User requests withdrawal of all AVAILABLE commissions
     */
    async requestWithdrawal(affiliateUid: string, dto: CreateWithdrawalRequestDto) {
        const available = await this.commissionRepository.find({
            where: { affiliate_uid: affiliateUid, status: WithdrawalStatus.AVAILABLE }
        });
        if (available.length === 0) throw new BadRequestException('No available commission to withdraw');

        const totalAmount = available.reduce((sum, e) => sum + Number(e.amount), 0);

        // Create the withdrawal request
        const request = this.withdrawalRequestRepository.create({
            affiliate_uid: affiliateUid,
            total_amount: totalAmount,
            status: WithdrawalRequestStatus.PENDING,
            user_note: dto.note ?? null
        });
        await this.withdrawalRequestRepository.save(request);

        // Link commissions to the request and mark as WITHDRAWN
        const commissionIds = available.map(e => e.id);
        await this.commissionRepository.update(commissionIds, {
            status: WithdrawalStatus.WITHDRAWN,
            withdrawal_request_id: request.id
        });

        return request;
    }

    /**
     * Get paginated withdrawal requests for a user
     */
    async getUserWithdrawals(affiliateUid: string, query: GetWithdrawalsQueryDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const skip = (page - 1) * limit;

        const where: any = { affiliate_uid: affiliateUid };
        if (query.status) where.status = query.status;

        const [data, total] = await this.withdrawalRequestRepository.findAndCount({
            where,
            order: { created_at: 'DESC' },
            skip,
            take: limit
        });

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Admin: get all withdrawal requests (paginated)
     */
    async getAllWithdrawals(query: GetWithdrawalsQueryDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (query.status) where.status = query.status;

        const [data, total] = await this.withdrawalRequestRepository.findAndCount({
            where,
            order: { created_at: 'DESC' },
            skip,
            take: limit
        });

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Admin: accept or reject a withdrawal request
     */
    async processWithdrawal(id: string, adminUserId: string, dto: ProcessWithdrawalDto) {
        const request = await this.withdrawalRequestRepository.findOne({ where: { id } });
        if (!request) throw new NotFoundException(`Withdrawal request ${id} not found`);
        if (request.status !== WithdrawalRequestStatus.PENDING) {
            throw new BadRequestException(`Cannot process withdrawal request in status: ${request.status}. Must be PENDING`);
        }

        request.status = dto.status;
        request.admin_note = dto.admin_note ?? null;
        request.processed_by = adminUserId;
        request.processed_at = new Date();
        await this.withdrawalRequestRepository.save(request);

        // If rejected, unlink commissions and revert to AVAILABLE

        if (dto.status === WithdrawalRequestStatus.REJECTED) {
            await this.commissionRepository.update({ withdrawal_request_id: request.id }, { status: WithdrawalStatus.AVAILABLE, withdrawal_request_id: null });
        }

        return request;
    }
}
