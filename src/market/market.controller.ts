import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { MarketService } from "./market.service";

@ApiTags('Market Data')
@Controller('market')
export class MarketController {

    constructor(private readonly marketService: MarketService) { }

    @Get('history')
    @ApiOperation({
        summary: 'Lấy dữ liệu nến lịch sử (Historical Data)'
    })
    async getHistory(@Query('symbol') symbol: string) {
        return this.marketService.getHistory(symbol);
    }

    // @Get('price')
    // @ApiOperation({ summary: 'Lấy giá khớp lệnh hiện tại (Real-time Snapshot)' })
    // async getLatestPrice(@Query('symbol') symbol: string) {
    //     return this.marketService.getLastestPrice(symbol);
    // }
}