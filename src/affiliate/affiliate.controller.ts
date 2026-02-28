import { Controller, Get, Query, UseGuards, Post, Body, Req, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AffiliateService } from './affiliate.service';
import { UpdateRateDto, GetInviteesQueryDto, GetCommissionsQueryDto, AffiliateResponseDto, CreateWithdrawalRequestDto, GetWithdrawalsQueryDto, ProcessWithdrawalDto } from './dto';

@ApiTags('Affiliate')
@Controller('affiliate')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AffiliateController {
    constructor(private readonly affiliateService: AffiliateService) {}

    @Get('overview')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Lấy thông tin tổng quan affiliate của user hiện tại' })
    @ApiResponse({ status: 200, description: 'Thành công' })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    async getOverview(@Req() req: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const refCode = req.user.ref_code as string;
        const result = await this.affiliateService.getUserOverview(refCode);
        return (
            result ?? {
                uid: refCode,
                email: '',
                refUid: '',
                refEmail: '',
                level: 0,
                percent: 0,
                totalInvitees: 0,
                totalInviteesBuy: 0,
                userBuy: 0,
                totalCommissions: 0,
                note: '',
                totalWithdrawn: 0,
                availableToWithdraw: 0
            }
        );
    }

    @Get('invitees')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Lấy danh sách người được user giới thiệu (chỉ direct children)' })
    @ApiResponse({ status: 200, description: 'Thành công' })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    async getInvitees(@Req() req: any, @Query() query: GetInviteesQueryDto) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        const result = await this.affiliateService.getUserInvitees(req.user.ref_code, query);
        return result;
    }

    @Get('commissions')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Lấy lịch sử commission của user' })
    @ApiResponse({ status: 200, description: 'Thành công' })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    async getCommissions(@Req() req: any, @Query() query: GetCommissionsQueryDto) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        const result = await this.affiliateService.getUserCommissions(req.user.ref_code, query);
        return result;
    }

    @Post('update-rate')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Cập nhật commission rate của direct invitee' })
    @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    @ApiResponse({ status: 403, description: 'Forbidden - not a direct invitee' })
    async updateRate(@Req() req: any, @Body() updateRateDto: UpdateRateDto): Promise<AffiliateResponseDto<any>> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        return await this.affiliateService.updateRate(req.user.ref_code, updateRateDto.targetUid, updateRateDto.rate);
    }

    @Post('withdrawals/request')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Yêu cầu rút tất cả commission AVAILABLE' })
    @ApiResponse({ status: 201, description: 'Yêu cầu thành công' })
    @ApiResponse({ status: 400, description: 'Không có commission để rút' })
    async requestWithdrawal(@Req() req: any, @Body() dto: CreateWithdrawalRequestDto) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return await this.affiliateService.requestWithdrawal(req.user.ref_code as string, dto);
    }

    @Get('withdrawals')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Lấy danh sách withdrawal của user hiện tại' })
    @ApiResponse({ status: 200, description: 'Thành công' })
    async getUserWithdrawals(@Req() req: any, @Query() query: GetWithdrawalsQueryDto) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return await this.affiliateService.getUserWithdrawals(req.user.ref_code as string, query);
    }

    @Get('admin/withdrawals')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: '[Admin] Lấy tất cả withdrawal entries' })
    @ApiResponse({ status: 200, description: 'Thành công' })
    @ApiResponse({ status: 403, description: 'Forbidden' })
    async getAllWithdrawals(@Query() query: GetWithdrawalsQueryDto) {
        return await this.affiliateService.getAllWithdrawals(query);
    }

    @Patch('admin/withdrawals/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: '[Admin] Chấp nhận hoặc từ chối withdrawal' })
    @ApiResponse({ status: 200, description: 'Xử lý thành công' })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    @ApiResponse({ status: 403, description: 'Forbidden' })
    @ApiResponse({ status: 404, description: 'Not Found' })
    async processWithdrawal(@Param('id') id: string, @Req() req: any, @Body() dto: ProcessWithdrawalDto) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return await this.affiliateService.processWithdrawal(id, req.user.id as string, dto);
    }
}
