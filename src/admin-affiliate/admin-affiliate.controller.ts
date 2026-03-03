import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminOnly } from 'src/auth/decorators/admin-only.decorator';
import { AdminAffiliateService } from './admin-affiliate.service';
import { ChangeStatusDto, ListAffiliatesQueryDto } from './dto';

@Controller('admin/affiliates')
@AdminOnly()
@ApiTags('Admin Affiliates')
export class AdminAffiliateController {
    constructor(private readonly adminAffiliateService: AdminAffiliateService) {}

    @Get()
    @ApiOperation({ summary: 'List affiliate users with commission/payment stats' })
    list(@Query() query: ListAffiliatesQueryDto) {
        return this.adminAffiliateService.list(query);
    }

    @Get(':uid')
    @ApiOperation({ summary: 'Get affiliate detail with metrics, recent requests and status logs' })
    getDetail(@Param('uid') uid: string) {
        return this.adminAffiliateService.getDetail(uid);
    }

    @Patch(':uid/status')
    @ApiOperation({ summary: 'Change affiliate status' })
    changeStatus(@Param('uid') uid: string, @Body() dto: ChangeStatusDto, @Req() req) {
        return this.adminAffiliateService.changeStatus(uid, dto.status, dto.reason, req.user.id);
    }

    @Get(':uid/status-logs')
    @ApiOperation({ summary: 'Get affiliate status change logs' })
    getStatusLogs(@Param('uid') uid: string) {
        return this.adminAffiliateService.getStatusLogs(uid);
    }
}
