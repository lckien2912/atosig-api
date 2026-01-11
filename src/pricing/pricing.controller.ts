import { Controller, Get, Post, Body, Param, UseGuards, Request, Patch } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Subscriptions (Pricing)')
@Controller('pricing')
export class PricingController {
    constructor(private readonly pricingService: PricingService) { }

    // ================= PUBLIC =================

    @Get('plans')
    @ApiOperation({ summary: 'Lấy danh sách các gói dịch vụ đang bán (Public)' })
    getPublicPlans() {
        return this.pricingService.findAllPlans(false);
    }

    // ================= USER =================

    @Post('subscribe')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '[USER] Mua gói dịch vụ (Tạm thời Active ngay)' })
    subscribe(@Request() req, @Body() dto: CreateSubscriptionDto) {
        return this.pricingService.subscribe(req.user.id, dto.plan_id);
    }

    @Get('my-history')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '[USER] Xem lịch sử mua gói' })
    getMyHistory(@Request() req) {
        return this.pricingService.getMySubscriptions(req.user.id);
    }

    // ================= ADMIN =================

    @Post('plans')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '[ADMIN] Tạo gói dịch vụ mới' })
    createPlan(@Body() dto: CreatePlanDto) {
        return this.pricingService.createPlan(dto);
    }

    @Get('admin/plans')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '[ADMIN] Lấy tất cả gói (cả ẩn và hiện)' })
    getAllPlansForAdmin() {
        return this.pricingService.findAllPlans(true);
    }

    @Patch('plans/:id/toggle')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '[ADMIN] Ẩn/Hiện gói dịch vụ' })
    togglePlan(@Param('id') id: string) {
        return this.pricingService.togglePlanStatus(id);
    }
}