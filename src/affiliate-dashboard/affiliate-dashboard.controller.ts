import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { AffiliateDashboardService } from './affiliate-dashboard.service';
import { DashboardQueryDto } from './dto';

@Controller('admin/dashboard/affiliate')
@AdminOnly()
@ApiTags('Admin Affiliate Dashboard')
export class AffiliateDashboardController {
    constructor(private readonly affiliateDashboardService: AffiliateDashboardService) {}

    @Get('kpis')
    @ApiOperation({ summary: 'Get affiliate KPI metrics' })
    getKPIs(@Query() query: DashboardQueryDto) {
        return this.affiliateDashboardService.getKPIs(query);
    }

    @Get('charts')
    @ApiOperation({ summary: 'Get affiliate chart data' })
    getCharts(@Query() query: DashboardQueryDto) {
        return this.affiliateDashboardService.getCharts(query);
    }
}
