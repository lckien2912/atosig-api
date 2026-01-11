import { Controller, Post, Body, Get, Query, UseGuards, Request, Res } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PaymentGateway } from './enums/payment.enum';

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) { }

    @Post('create-url')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Tạo URL thanh toán (VNPAY/MOMO...)' })
    createPaymentUrl(@Request() req, @Body() dto: CreatePaymentDto) {
        return this.paymentService.createPaymentUrl(req.user.id, dto);
    }

    @Get('vnpay/ipn')
    @ApiOperation({ summary: 'Webhook xử lý kết quả VNPAY' })
    async vnpayIpn(@Query() query: any) {
        return this.paymentService.processPaymentCallback(PaymentGateway.VNPAY, query);
    }

    @Post('momo/ipn')
    @ApiOperation({ summary: 'Webhook xử lý kết quả MOMO' })
    async momoIpn(@Body() body: any) {
        return this.paymentService.processPaymentCallback(PaymentGateway.MOMO, body);
    }

    // API MOCK SUCCESS (Để bạn test luồng khi chưa có key thật)
    @Get('mock-success')
    @ApiOperation({ summary: '[DEV ONLY] Giả lập thanh toán thành công' })
    async mockSuccess(@Query('code') code: string) {
        return this.paymentService.processPaymentCallback(PaymentGateway.MANUAL, { code });
    }
}