import { Controller, Get, Param, Query, UseGuards, UseInterceptors, Request, Post, Delete } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { SignalService } from "./signal.service";
import { TransformInterceptor } from "../common/interceptors/transform.interceptor";
import { OptionalJwtAuthGuard } from "src/auth/guards/optional-jwt-auth.guard";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { RolesGuard } from "src/auth/guards/roles.guard";

@ApiTags("Signals")
@Controller("signals")
@UseInterceptors(TransformInterceptor)
export class SignalController {
    constructor(private readonly signalService: SignalService) { }

    @Get()
    @UseGuards(OptionalJwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Lấy danh sách tín hiệu (Khách xem che, User xem full)' })
    findAll(
        @Request() req,
        @Query("page") page: number = 1,
        @Query("limit") limit: number = 10,
        @Query("duration") duration?: string,
    ) {
        return this.signalService.findAll({ page, limit, duration, currentUser: req.user });
    }

    @Get('watchlist')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Lấy danh sách tín hiệu yêu thích (Watchlist)' })
    getWatchlist(
        @Request() req,
        @Query("page") page: number = 1,
        @Query("limit") limit: number = 10,
    ) {
        return this.signalService.getWatchlist(req.user, page, limit);
    }

    @Get('metrics')
    @UseGuards(OptionalJwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Lấy các chỉ số thống kê hiệu suất (Metrics Dashboard)' })
    async getMetrics() {
        return this.signalService.geTradingMetrics();
    }

    @Get(":id")
    @UseGuards(OptionalJwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Xem chi tiết tín hiệu' })
    findOne(@Param("id") id: string, @Request() req) {
        return this.signalService.findOne(id, req.user);
    }

    @Post(':id/favorite')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Thêm/Xóa tín hiệu khỏi Watchlist (Toggle)' })
    toggleFavorite(@Param("id") id: string, @Request() req) {
        return this.signalService.toggleFavorite(id, req.user.id);
    }

    @Get('admin/list')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: '[ADMIN] Lấy danh sách tín hiệu (Full Data)' })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 20 })
    @ApiQuery({ name: 'symbol', required: false, description: 'Tìm theo mã CK' })
    @ApiQuery({ name: 'status', required: false, description: 'Lọc theo trạng thái (PENDING, ACTIVE, CLOSED)' })
    async getListForAdmin(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20,
        @Query('symbol') symbol?: string,
        @Query('status') status?: string,
    ) {
        return this.signalService.findAllForAdmin({
            page,
            limit,
            symbol,
            status
        });
    }

    @Get('admin/detail/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: '[ADMIN] Xem chi tiết tín hiệu' })
    async getDetailForAdmin(@Param('id') id: string) {
        return this.signalService.findOneForAdmin(id);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: '[ADMIN] Xóa tín hiệu' })
    deleteSignal(@Param('id') id: string) {
        return this.signalService.deleteSignal(id);
    }
}
