import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { Granularity } from '../enums/granularity.enum';

export class DashboardQueryDto {
    @ApiProperty({ example: '2024-01-01' })
    @IsDateString()
    fromDate: string;

    @ApiProperty({ example: '2024-12-31' })
    @IsDateString()
    toDate: string;

    @ApiPropertyOptional({ enum: Granularity, default: Granularity.DAY })
    @IsOptional()
    @IsEnum(Granularity)
    granularity?: Granularity = Granularity.DAY;
}
