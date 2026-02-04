import { ApiProperty } from '@nestjs/swagger';

export class MonthlyProfitFactorDto {
    @ApiProperty({ description: 'Tháng (format: mm-yyyy)', example: '01-2026' })
    month: string;

    @ApiProperty({ description: 'Hệ số lợi nhuận của tháng', example: 2.05 })
    profitFactor: number;

    @ApiProperty({ description: 'Tổng lãi gộp của tháng', example: 150.5 })
    grossProfit: number;

    @ApiProperty({ description: 'Tổng lỗ gộp của tháng (giá trị dương)', example: 73.4 })
    grossLoss: number;
}

export class ProfitFactorResponseDto {
    @ApiProperty({ description: 'Hệ số lợi nhuận của tháng gần nhất', example: 2.05 })
    profitFactor: number;

    @ApiProperty({ 
        description: 'Dữ liệu Profit Factor theo từng tháng (12 phần tử)', 
        type: [MonthlyProfitFactorDto] 
    })
    monthlyData: MonthlyProfitFactorDto[];
}
