import { Controller, Get, Patch, Post, Query, Param, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminOnly } from 'src/auth/decorators/admin-only.decorator';
import { AdminCommissionService } from './admin-commission.service';
import { ListWithdrawalRequestsQueryDto, ProcessWithdrawalRequestDto, BulkActionDto } from './dto';

@Controller('admin/commissions')
@AdminOnly()
@ApiTags('Admin Commissions')
export class AdminCommissionController {
    constructor(private readonly adminCommissionService: AdminCommissionService) {}

    @Get()
    @ApiOperation({ summary: 'List withdrawal requests with filters' })
    list(@Query() query: ListWithdrawalRequestsQueryDto) {
        return this.adminCommissionService.list(query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get withdrawal request detail' })
    getDetail(@Param('id') id: string) {
        return this.adminCommissionService.getDetail(id);
    }

    @Patch(':id/approve')
    @ApiOperation({ summary: 'Approve a withdrawal request' })
    approve(@Param('id') id: string, @Req() req: any, @Body() dto: ProcessWithdrawalRequestDto) {
        return this.adminCommissionService.approve(id, dto, req.user.id as string);
    }

    @Patch(':id/reject')
    @ApiOperation({ summary: 'Reject a withdrawal request' })
    reject(@Param('id') id: string, @Req() req: any, @Body() dto: ProcessWithdrawalRequestDto) {
        return this.adminCommissionService.reject(id, dto, req.user.id as string);
    }

    @Patch(':id/hold')
    @ApiOperation({ summary: 'Put a withdrawal request on hold' })
    hold(@Param('id') id: string, @Req() req: any, @Body() dto: ProcessWithdrawalRequestDto) {
        return this.adminCommissionService.hold(id, dto, req.user.id as string);
    }

    @Patch(':id/release-hold')
    @ApiOperation({ summary: 'Release a held withdrawal request back to pending' })
    releaseHold(@Param('id') id: string, @Req() req: any) {
        return this.adminCommissionService.releaseHold(id, req.user.id as string);
    }

    @Patch(':id/revert')
    @ApiOperation({ summary: 'Revert a rejected withdrawal request' })
    revert(@Param('id') id: string, @Req() req: any) {
        return this.adminCommissionService.revert(id, req.user.id as string);
    }

    @Post('bulk-action')
    @ApiOperation({ summary: 'Bulk approve/reject/hold withdrawal requests' })
    bulkAction(@Req() req: any, @Body() dto: BulkActionDto) {
        return this.adminCommissionService.bulkAction(dto, req.user.id as string);
    }
}
