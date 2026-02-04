import { ApiProperty } from '@nestjs/swagger';

export class MetricsResponseDto {
    @ApiProperty({ description: 'Tỉ lệ thắng (%)', example: 88.89 })
    winRate: number;

    @ApiProperty({ description: 'Lợi nhuận trung bình mỗi lệnh (%)', example: 5.8 })
    avgProfit: number;

    @ApiProperty({ description: 'Tổng số tín hiệu', example: 452 })
    totalSignals: number;

    @ApiProperty({ description: 'Thời gian nắm giữ trung bình', example: 7 })
    avgHoldingTime: number;

    @ApiProperty({ description: 'Mức sụt giảm tối đa (% chênh lệch giữa actualEfficiency cao nhất và thấp nhất)', example: -7.5 })
    maxDrawdown: number;

    @ApiProperty({ description: 'Lợi nhuận tối đa', example: 10.5 })
    maxProfit: number;

    @ApiProperty({ description: 'Lợi nhuận tối thiểu', example: -10.5 })
    minProfit: number;
}