import { IsOptional, IsNumber, IsString, Min, Max, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GetInviteesQueryDto {
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
    size?: number = 10;

    @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm (email)', example: 'user@example.com' })
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({ description: 'Level của affiliate', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    level?: number;

    @ApiPropertyOptional({ description: 'Ngày bắt đầu (YYYY-MM-DD)', example: '2026-01-01' })
    @IsOptional()
    @IsDateString()
    fromDate?: string;

    @ApiPropertyOptional({ description: 'Ngày kết thúc (YYYY-MM-DD)', example: '2026-12-31' })
    @IsOptional()
    @IsDateString()
    toDate?: string;
}
