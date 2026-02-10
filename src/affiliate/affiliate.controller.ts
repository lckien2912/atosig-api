import { Controller, Get, Query, UseGuards, Request, Param, Post, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AffiliateService } from './affiliate.service';
import { UpdateRateDto, GetUserParamDto, GetInviteesQueryDto, GetCommissionsQueryDto, AffiliateResponseDto } from './dto';

@ApiTags('Affiliate')
@Controller('affiliate')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AffiliateController {
    constructor(private readonly affiliateService: AffiliateService) {}

    @Get('overview/:uid')
    @ApiOperation({ summary: 'Lấy thông tin tổng quan affiliate của user hiện tại' })
    @ApiResponse({
        status: 200,
        description: 'Thành công'
    })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    async getOverview(@Param() param: GetUserParamDto) {
        const result = await this.affiliateService.getUserOverview(param.uid);
        return result;
    }

    @Get('invitees/:uid')
    @ApiOperation({ summary: 'Lấy danh sách người được user giới thiệu' })
    @ApiResponse({
        status: 200,
        description: 'Thành công'
    })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    async getInvitees(@Param() param: GetUserParamDto, @Query() query: GetInviteesQueryDto) {
        const result = await this.affiliateService.getUserInvitees(param, query);
        return result;
    }

    @Get('commissions/:uid')
    @ApiOperation({ summary: 'Lấy lịch sử commission của user' })
    @ApiResponse({
        status: 200,
        description: 'Thành công'
    })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    async getCommissions(@Param() param: GetUserParamDto, @Query() query: GetCommissionsQueryDto) {
        const result = await this.affiliateService.getUserCommissions(param, query);
        return result;
    }

    @Post('update-rate')
    @ApiOperation({ summary: 'Cập nhật commission rate của user (cho admin)' })
    @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    async updateRate(@Body() updateRateDto: UpdateRateDto): Promise<AffiliateResponseDto<any>> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return await this.affiliateService.updateRate(updateRateDto.sourceUid, updateRateDto.targetUid, updateRateDto.rate);
    }
}
