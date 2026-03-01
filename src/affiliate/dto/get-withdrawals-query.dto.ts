import { IsOptional, IsNumber, IsEnum, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { WithdrawalRequestStatus } from '../enums/withdrawal-request-status.enum';

export class GetWithdrawalsQueryDto {
    @ApiPropertyOptional({ description: 'Số trang', example: 1, default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ description: 'Số lượng item mỗi trang', example: 10, default: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number = 10;

    @ApiPropertyOptional({ description: 'Lọc theo trạng thái', enum: WithdrawalRequestStatus })
    @IsOptional()
    @IsEnum(WithdrawalRequestStatus)
    status?: WithdrawalRequestStatus;
}
