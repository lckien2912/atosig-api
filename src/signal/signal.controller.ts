import { Controller, Get, Param, Query, UseGuards, UseInterceptors, Request, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SignalService } from "./signal.service";
import { TransformInterceptor } from "../common/interceptors/transform.interceptor";
import { OptionalJwtAuthGuard } from "src/auth/guards/optional-jwt-auth.guard";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";

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
        return this.signalService.getWatchlist(req.user.id, page, limit);
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
}
