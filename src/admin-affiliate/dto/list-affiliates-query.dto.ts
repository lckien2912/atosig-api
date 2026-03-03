import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AffiliateStatus, AffiliateTier } from 'src/users/enums/user-status.enum';

export class ListAffiliatesQueryDto {
    @ApiPropertyOptional({ enum: [...Object.values(AffiliateStatus), 'ALL'] })
    @IsOptional()
    @IsString()
    status?: AffiliateStatus | 'ALL';

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ enum: AffiliateTier })
    @IsOptional()
    @IsEnum(AffiliateTier)
    tier?: AffiliateTier;

    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page: number = 1;

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    size: number = 20;
}
