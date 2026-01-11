import { IsEnum, IsNotEmpty, IsString, IsNumber, Min, IsOptional } from 'class-validator';
import { PaymentGateway } from '../enums/payment.enum';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentDto {
    @ApiProperty({ description: 'ID của Subscription (lấy từ bảng user_subscriptions)' })
    @IsNotEmpty()
    @IsString()
    subscription_id: string;

    @ApiProperty({ enum: PaymentGateway, example: PaymentGateway.VNPAY })
    @IsEnum(PaymentGateway)
    gateway: PaymentGateway;

    // Dùng cho trường hợp thanh toán quốc tế, user muốn trả bằng USD
    @ApiProperty({ required: false, example: 'VND' })
    @IsOptional()
    currency?: string;
}