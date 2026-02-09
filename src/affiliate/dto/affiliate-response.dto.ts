import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AffiliateUserOverviewDto {
    @ApiProperty({ description: 'User ID', example: 'user123' })
    uid: string;

    @ApiProperty({ description: 'Email của user', example: 'user@example.com' })
    email: string;

    @ApiProperty({ description: 'Referrer User ID', example: 'ref123' })
    refUid: string;

    @ApiProperty({ description: 'Email của referrer', example: 'ref@example.com' })
    refEmail: string;

    @ApiProperty({ description: 'Level của affiliate', example: 1 })
    level: number;

    @ApiProperty({ description: 'Commission percent', example: 10 })
    percent: number;

    @ApiProperty({ description: 'Tổng số người được giới thiệu', example: 50 })
    totalInvitees: number;

    @ApiProperty({ description: 'Tổng số người được giới thiệu đã mua', example: 20 })
    totalInviteesBuy: number;

    @ApiProperty({ description: 'Số lần user đã mua', example: 5 })
    userBuy: number;

    @ApiProperty({ description: 'Tổng commission', example: 1000000 })
    totalCommissions: number;

    @ApiProperty({ description: 'Ghi chú', example: 'VIP user' })
    note: string;
}

export class AffiliateInviteeDto {
    @ApiProperty({ description: 'User ID', example: 'user123' })
    uid: string;

    @ApiProperty({ description: 'Referrer User ID', example: 'ref123' })
    refUid: string;

    @ApiProperty({ description: 'Level của affiliate', example: 1 })
    level: number;

    @ApiProperty({ description: 'Commission percent', example: 10 })
    percent: number;

    @ApiProperty({ description: 'Tổng số tiền mua', example: 5 })
    purchased: string;

    @ApiProperty({ description: 'Tổng commission của user', example: 500000 })
    yourCom: string;

    @ApiProperty({ example: 1704067200000 })
    createdAt: number;

    @ApiProperty({ description: 'Ghi chú', example: 'VIP user' })
    note: string;
}

export class AffiliateCommissionDto {
    @ApiProperty({ description: 'User ID', example: 'A9YCPL01' })
    uid: string;

    @ApiProperty({ description: 'Ghi chú', example: '' })
    note: string;

    @ApiProperty({ description: 'Level của affiliate', example: 3 })
    level: number;

    @ApiProperty({ description: 'Tên gói hoặc tên đơn hàng', example: 'Gói 3 tháng' })
    name: string;

    @ApiProperty({ description: 'Số tiền gốc', example: '4999000' })
    fromAmount: string;

    @ApiProperty({ description: 'Commission percent', example: 5 })
    percent: number;

    @ApiProperty({ description: 'Số tiền commission', example: '249950' })
    amount: string;

    @ApiProperty({ description: 'Ngày tạo (timestamp)', example: 1770637177 })
    createdAt: number;
}

export class AffiliatePaginationDto {
    @ApiProperty({ description: 'Số trang', example: 1 })
    pages: number;

    @ApiProperty({ description: 'Số lượng item mỗi trang', example: 10 })
    size: number;

    @ApiProperty({ description: 'Tổng số item', example: 100 })
    total: number;

    @ApiProperty({ description: 'Trang hiện tại', example: 1 })
    current: number;
}

export class AffiliateResponseDto<T> {
    @ApiProperty({ description: 'Mã response', example: 1 })
    code: number;

    @ApiProperty({ description: 'Thông báo', example: 'Success' })
    message: string;

    @ApiProperty({ description: 'Dữ liệu response' })
    data: T;

    @ApiPropertyOptional({ description: 'Thông tin phân trang', type: AffiliatePaginationDto })
    pagination?: AffiliatePaginationDto;
}

// Specific response classes for Swagger documentation
export class AffiliateUserOverviewResponseDto extends AffiliateResponseDto<AffiliateUserOverviewDto> {}

export class AffiliateInviteesResponseDto extends AffiliateResponseDto<AffiliateInviteeDto[]> {}

export class AffiliateCommissionsResponseDto extends AffiliateResponseDto<AffiliateCommissionDto[]> {}
