import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { CompanyService } from "./company.service";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";

@ApiTags('Company (Thông tin Doanh nghiệp)')
@Controller("company")
export class CompanyController {
    constructor(private readonly companyService: CompanyService) { }

    @Get('detail/:symbol')
    @ApiOperation({
        summary: 'Lấy chi tiết công ty theo mã (Ticker)',
        description: 'Trả về thông tin hồ sơ, chỉ số tài chính (P/E, ROE...) của kỳ báo cáo gần nhất.'
    })
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiResponse({ status: 200, description: 'Thành công' })
    @ApiResponse({ status: 404, description: 'Không tìm thấy mã chứng khoán' })
    async getCompanyDetail(@Param('symbol') symbol: string) {
        return await this.companyService.getCompanyBySymbol(symbol);
    }
}