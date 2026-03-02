import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class AdminUpgradeDto {
    @ApiProperty({ description: 'UUID của user cần nâng cấp' })
    @IsString()
    @IsNotEmpty()
    @IsUUID()
    user_id: string;

    @ApiProperty({ description: 'UUID của gói dịch vụ' })
    @IsString()
    @IsNotEmpty()
    @IsUUID()
    plan_id: string;
}
