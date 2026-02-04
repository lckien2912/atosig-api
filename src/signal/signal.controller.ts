import { Controller, Get, Param, Query, UseGuards, UseInterceptors, Request, Post, Delete, Body } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { SignalService } from "./signal.service";
import { CreateSignalDto } from "./dto/create-signal.dto";
import { MetricsFilterDto } from "./dto/metrics-filter.dto";
import { ProfitFactorFilterDto } from "./dto/profit-factor-filter.dto";
import { SignalListFilterDto } from "./dto/signal-list-filter.dto";
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
        @Query() filter: SignalListFilterDto,
    ) {
        return this.signalService.findAll({ 
            page: filter.page || 1, 
            limit: filter.limit || 10, 
            startDate: filter.startDate,
            endDate: filter.endDate,
            currentUser: req.user 
        });
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
    @ApiQuery({ name: 'startDate', required: false, example: '2026-01-01' })
    @ApiQuery({ name: 'endDate', required: false, example: '2026-12-31' })
    async getMetrics(@Query() filter: MetricsFilterDto) {
        return this.signalService.getTradingMetrics(filter);
    }

    @Get('profit-factor')
    @UseGuards(OptionalJwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Lấy Profit Factor theo từng tháng (Chart Data)' })
    @ApiQuery({ name: 'year', required: false, example: 2026 })
    async getProfitFactor(@Query() filter: ProfitFactorFilterDto) {
        return this.signalService.getProfitFactor(filter);
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

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: '[ADMIN] Tạo tín hiệu mới (Create Signal)' })
    create(@Body() createSignalDto: CreateSignalDto) {
        return this.signalService.create(createSignalDto);
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
