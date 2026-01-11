import { Controller, Get, Param, Query, UseGuards, UseInterceptors, Request } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SignalService } from "./signal.service";
import { TransformInterceptor } from "../common/interceptors/transform.interceptor";
import { OptionalJwtAuthGuard } from "src/auth/guards/optional-jwt-auth.guard";

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

    @Get(":id")
    @UseGuards(OptionalJwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Xem chi tiết tín hiệu' })
    findOne(@Param("id") id: string, @Request() req) {
        return this.signalService.findOne(id, req.user);
    }
}
