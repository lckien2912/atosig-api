import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
    CreateAffiliateUserDto,
    CreateAffiliateOrderDto,
    AffiliateUserOverviewDto,
    AffiliateInviteeDto,
    AffiliateCommissionDto,
    AffiliateResponseDto,
    GetUserParamDto,
    GetInviteesQueryDto,
    GetCommissionsQueryDto
} from './dto';
import { AffiliateErrorCode } from './enums/affiliate-error-code.enum';
import { handleAffiliateError, handleAxiosError } from './helpers/affiliate-error-handler';

@Injectable()
export class AffiliateService {
    private readonly logger = new Logger(AffiliateService.name);
    private readonly baseUrl: string;
    private readonly apiKey: string;
    private readonly defaultPercent: number;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService
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
    async createOrder(uid: string, orderId: string, orderName: string, orderPayPrice: number, orderActuallyPaid: number): Promise<AffiliateResponseDto<any>> {
        try {
            const dto: CreateAffiliateOrderDto = {
                uid,
                orderId,
                orderName,
                orderPayPrice,
                orderActuallyPaid
            };

            const response: AxiosResponse<AffiliateResponseDto<any>> = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/api/v1/orders`, dto, {
                    headers: this.getHeaders()
                })
            );

            const responseData = response.data;
            if (responseData.code !== AffiliateErrorCode.SUCCESS) {
                handleAffiliateError(responseData.code as AffiliateErrorCode, responseData.message);
            }

            this.logger.log(`Created affiliate order: ${orderId} for user: ${uid}`);
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
            if (responseData.code !== AffiliateErrorCode.SUCCESS) {
                handleAffiliateError(responseData.code as AffiliateErrorCode, responseData.message);
            }

            return responseData.data;
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

    /**
     * Lấy danh sách invitees của user
     */
    async getUserInvitees(param: GetUserParamDto, query: GetInviteesQueryDto) {
        try {
            // Nếu không truyền ngày, set mặc định từ đầu năm 2026 đến ngày hiện tại + 1 ngày
            if (!query.fromDate && !query.toDate) {
                const defaultFromDate = new Date('2026-01-01');
                const defaultToDate = new Date();
                defaultToDate.setDate(defaultToDate.getDate() + 1);
                query.fromDate = defaultFromDate.toISOString().split('T')[0];
                query.toDate = defaultToDate.toISOString().split('T')[0];
            }

            const response: AxiosResponse<AffiliateResponseDto<AffiliateInviteeDto[]>> = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/api/v1/users/invitees/${param.uid}`, {
                    headers: this.getHeaders(),
                    params: query
                })
            );

            const responseData = response.data;
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
                totalPages: Number(totalPages),
              }
            };
        } catch (error) {
            this.logger.error(`Failed to get invitees for user: ${param.uid}`, error instanceof Error ? error.message : String(error));
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
    async getUserCommissions(param: GetUserParamDto, query: GetCommissionsQueryDto) {
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
                this.httpService.get(`${this.baseUrl}/api/v1/users/commissions/${param.uid}`, {
                    headers: this.getHeaders(),
                    params: query
                })
            );

            const responseData = response.data;
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
                totalPages: Number(totalPages),
              }
            };
        } catch (error) {
            this.logger.error(`Failed to get commissions for user: ${param.uid}`, error instanceof Error ? error.message : String(error));
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
     * Cập nhật commission rate của user (cho admin)
     */
    async updateRate(sourceUid: string, targetUid: string, rate: number): Promise<AffiliateResponseDto<any>> {
        try {
            const response: AxiosResponse<AffiliateResponseDto<any>> = await firstValueFrom(
                this.httpService.post(
                    `${this.baseUrl}/api/v1/users/update-rate`,
                    { sourceUid, targetUid, rate },
                    { headers: this.getHeaders() }
                )
            );
            this.logger.log(response.data);

            const responseData = response.data;
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
}
