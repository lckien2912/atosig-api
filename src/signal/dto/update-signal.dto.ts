import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSignalDto {
    @ApiProperty({ example: 'BTCUSDT', required: false })
    @IsString()
    @IsOptional()
    symbol?: string;

    @ApiProperty({ example: 'BINANCE', required: false })
    @IsString()
    @IsOptional()
    exchange?: string;

    @ApiProperty({ example: 40000, required: false })
    @IsNumber()
    @IsOptional()
    entry_price_min?: number;

    @ApiProperty({ example: 40000, required: false })
    @IsNumber()
    @IsOptional()
    entry_price_max?: number;

    @ApiProperty({ example: 40500, required: false })
    @IsNumber()
    @IsOptional()
    price_base?: number;

    @ApiProperty({ example: '2024-01-27T10:00:00.000Z', required: false })
    @IsDateString()
    @IsOptional()
    entry_date?: string;

    @ApiProperty({ example: 38000, required: false })
    @IsNumber()
    @IsOptional()
    stop_loss_price?: number;

    @ApiProperty({ example: 5, required: false, description: 'Stop Loss %' })
    @IsNumber()
    @IsOptional()
    stop_loss_pct?: number;

    @ApiProperty({ example: 42000, required: false })
    @IsNumber()
    @IsOptional()
    tp1_price?: number;

    @ApiProperty({ example: 5, required: false, description: 'TP1 %' })
    @IsNumber()
    @IsOptional()
    tp1_pct?: number;

    @ApiProperty({ example: 44000, required: false })
    @IsNumber()
    @IsOptional()
    tp2_price?: number;

    @ApiProperty({ example: 10, required: false, description: 'TP2 %' })
    @IsNumber()
    @IsOptional()
    tp2_pct?: number;

    @ApiProperty({ example: 46000, required: false })
    @IsNumber()
    @IsOptional()
    tp3_price?: number;

    @ApiProperty({ example: 15, required: false, description: 'TP3 %' })
    @IsNumber()
    @IsOptional()
    tp3_pct?: number;

    @ApiProperty({ example: 1.5, required: false, description: 'ATR % used for calculation' })
    @IsNumber()
    @IsOptional()
    atr_pct?: number;

    @ApiProperty({ example: '2024-01-27T09:00:00.000Z', required: false })
    @IsDateString()
    @IsOptional()
    signal_date?: string;

    @ApiProperty({ example: '2024-02-10T00:00:00.000Z', required: false, description: 'Holding period deadline' })
    @IsDateString()
    @IsOptional()
    holding_period?: string;

    @ApiProperty({ example: 0, required: false })
    @IsNumber()
    @IsOptional()
    current_price?: number;

    @ApiProperty({ example: 0, required: false })
    @IsNumber()
    @IsOptional()
    current_change_percent?: number;

    @ApiProperty({ example: '2024-01-27T10:00:00.000Z', required: false })
    @IsDateString()
    @IsOptional()
    tp1_hit_at?: string;

    @ApiProperty({ example: '2024-01-27T10:00:00.000Z', required: false })
    @IsDateString()
    @IsOptional()
    tp2_hit_at?: string;

    @ApiProperty({ example: '2024-01-27T10:00:00.000Z', required: false })
    @IsDateString()
    @IsOptional()
    tp3_hit_at?: string;

    @ApiProperty({ example: '2024-01-27T10:00:00.000Z', required: false })
    @IsDateString()
    @IsOptional()
    sl_hit_at?: string;

    @ApiProperty({ example: '2024-01-27T10:00:00.000Z', required: false })
    @IsDateString()
    @IsOptional()
    closed_at?: string;

    @ApiProperty({ example: 0, required: false })
    @IsNumber()
    @IsOptional()
    highest_price?: number;

    @ApiProperty({ example: true, required: false })
    @IsBoolean()
    @IsOptional()
    is_premium?: boolean;

    @ApiProperty({ example: false, required: false })
    @IsBoolean()
    @IsOptional()
    is_expired?: boolean;
}
