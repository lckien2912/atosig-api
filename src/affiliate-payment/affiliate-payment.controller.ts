import { Controller, Get, Post, Query, Param, Body, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { AdminOnly } from 'src/auth/decorators/admin-only.decorator';
import { AffiliatePaymentService } from './affiliate-payment.service';
import { CreatePaymentBatchDto, ListPaymentsQueryDto } from './dto';

@Controller('admin/payments')
@AdminOnly()
@ApiTags('Admin Payments')
export class AffiliatePaymentController {
    constructor(private readonly affiliatePaymentService: AffiliatePaymentService) {}

    @Post('batch')
    @ApiOperation({ summary: 'Create a payment batch for approved withdrawal requests' })
    createBatch(@Body() dto: CreatePaymentBatchDto, @Req() req: any) {
        return this.affiliatePaymentService.createBatch(dto, req.user.id as string);
    }

    @Post(':id/proof')
    @ApiOperation({ summary: 'Upload payment proof' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('proof'))
    uploadProof(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Req() req: any) {
        return this.affiliatePaymentService.uploadProof(id, file, req.user.id as string);
    }

    @Get()
    @ApiOperation({ summary: 'List payments with filters' })
    list(@Query() query: ListPaymentsQueryDto) {
        return this.affiliatePaymentService.list(query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get payment detail with linked withdrawal requests' })
    getDetail(@Param('id') id: string) {
        return this.affiliatePaymentService.getDetail(id);
    }
}
