import { ApiProperty } from '@nestjs/swagger';

export class MetricsResponseDto {
    @ApiProperty({ description: 'Tỉ lệ thắng (%)', example: 88.89 })
    winRate: number;

    @ApiProperty({ description: 'Lợi nhuận trung bình mỗi lệnh (%)', example: 5.8 })
    avgProfit: number;

    @ApiProperty({ description: 'Hệ số lợi nhuận (Gross Profit / Gross Loss)', example: 2.05 })
    profitFactor: number;

    @ApiProperty({ description: 'Tổng số tín hiệu', example: 452 })
    totalSignals: number;

    @ApiProperty({ description: 'Thời gian nắm giữ trung bình (giờ hoặc chuỗi text)', example: '7 ngày' })
    avgHoldingTime: string;

    @ApiProperty({ description: 'Mức sụt giảm tối đa (Dựa trên Max StopLoss %)', example: -7.5 })
    maxStopLossPct: number;
}