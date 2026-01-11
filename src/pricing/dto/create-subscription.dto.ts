import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateSubscriptionDto {
    @ApiProperty({ description: 'ID của gói dịch vụ muốn mua' })
    @IsString()
    @IsNotEmpty()
    plan_id: string;

    // Sau này có thể thêm payment_method ở đây
}