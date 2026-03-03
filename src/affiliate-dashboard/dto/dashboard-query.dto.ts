import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class DashboardQueryDto {
    @ApiProperty({ example: '2024-01-01' })
    @IsDateString()
    fromDate: string;

    @ApiProperty({ example: '2024-12-31' })
    @IsDateString()
    toDate: string;

    @ApiPropertyOptional({ enum: ['day', 'week', 'month'], default: 'day' })
    @IsOptional()
    @IsEnum(['day', 'week', 'month'])
    granularity?: string = 'day';
}
