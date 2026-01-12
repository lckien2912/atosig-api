import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsArray, IsOptional, IsBoolean, Min } from 'class-validator';
import { UserSubscriptionTier } from '../../users/enums/user-status.enum';

export class CreatePlanDto {
    @ApiProperty({ example: 'Gói 3 tháng' })
    @IsString()
    name: string;

    @ApiProperty({ example: 'Truy cập full tín hiệu VIP' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ example: 4990000 })
    @IsNumber()
    @Min(0)
    price: number; // Giá bán thực tế (VD: 1990000)

    @ApiProperty({ example: 30, required: false })
    @IsOptional()
    @IsNumber()
    discount_percentage?: number;

    @ApiProperty({ example: 90, description: 'Số ngày hiệu lực' })
    @IsNumber()
    @Min(1)
    duration_days: number;

    @ApiProperty({ enum: UserSubscriptionTier, example: UserSubscriptionTier.PREMIUM })
    @IsEnum(UserSubscriptionTier)
    tier: UserSubscriptionTier;

    @ApiProperty({ example: ['Tín hiệu Realtime', 'Hỗ trợ 1-1', 'Báo cáo tuần'] })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    features?: string[];

    @ApiProperty({ example: true, required: false })
    @IsOptional()
    @IsBoolean()
    is_featured?: boolean;

    @ApiProperty({ example: true, required: false, description: 'Trạng thái hoạt động' })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}