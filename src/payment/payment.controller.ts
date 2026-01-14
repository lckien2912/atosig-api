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
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Tạo URL thanh toán (VNPAY/MOMO...)' })
    createPaymentUrl(@Request() req, @Body() dto: CreatePaymentDto) {
        let ipAddr = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.ip;

        if (Array.isArray(ipAddr)) {
            ipAddr = ipAddr[0];
        } else if (typeof ipAddr === 'string' && ipAddr.includes(',')) {
            ipAddr = ipAddr.split(',')[0].trim();
        }

        return this.paymentService.createPaymentUrl(req.user.id, dto, ipAddr);
    }

    @Get('vnpay/ipn')
    @ApiOperation({ summary: 'Webhook xử lý kết quả VNPAY (Server-to-Server)' })
    async vnpayIpn(@Query() query: any) {
        return this.paymentService.processPaymentCallback(PaymentGateway.VNPAY, query);
    }

    // Return URL - Browser user redirect về đây sau khi thanh toán xong
    // API này chỉ để hiển thị UI "Thành công" hay "Thất bại", không dùng để update DB (vì user có thể tắt tab)
    @Get('vnpay/return')
    @ApiOperation({ summary: 'Xử lý redirect từ VNPAY về Frontend' })
    async vnpayReturn(@Query() query: any, @Res() res) {
        const result = this.paymentService.checkReturnUrl(query);

        if (!result.isValid) {
            return res.status(400).json({ message: 'Gian lận: Sai chữ ký checksum' });
        }

        if (result.isSuccess) {
            return res.json({
                message: 'Thanh toán thành công',
                data: query
            });
        } else {
            return res.json({
                message: 'Thanh toán thất bại hoặc bị hủy',
                data: query
            });
        }
    }

    @Post('momo/ipn')
    @ApiOperation({ summary: 'Webhook xử lý kết quả MOMO' })
    async momoIpn(@Body() body: any) {
        await this.paymentService.processPaymentCallback(PaymentGateway.MOMO, body);
        return { message: 'IPN Received' };
    }

    @Get('momo/return')
    @ApiOperation({ summary: 'Xử lý redirect từ Momo về Frontend' })
    async momoReturn(@Query() query: any, @Res() res) {
        if (Number(query.resultCode) === 0) {
            return res.json({ message: 'Thanh toán Momo thành công', data: query });
        } else {
            return res.json({ message: 'Thanh toán thất bại', data: query });
        }
    }

    @Get('mock-success')
    @ApiOperation({ summary: '[DEV ONLY] Giả lập thanh toán thành công' })
    async mockSuccess(@Query('code') code: string) {
        return this.paymentService.processPaymentCallback(PaymentGateway.MANUAL, { code });
    }
}