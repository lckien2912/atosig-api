import { IsOptional, IsEnum, IsString, IsDateString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum WithdrawalRequestFilterStatus {
    PENDING = 'PENDING',
    ACCEPTED = 'ACCEPTED',
    PAID = 'PAID',
    REJECTED = 'REJECTED',
    REVERTED = 'REVERTED',
    ALL = 'ALL'
}

export class ListWithdrawalRequestsQueryDto {
    @IsOptional()
    @IsEnum(WithdrawalRequestFilterStatus)
    status: WithdrawalRequestFilterStatus = WithdrawalRequestFilterStatus.ALL;

    @IsOptional()
    @IsString()
    affiliateUid?: string;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsDateString()
    fromDate?: string;

    @IsOptional()
    @IsDateString()
    toDate?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(5)
    @Max(100)
    size: number = 20;
}
