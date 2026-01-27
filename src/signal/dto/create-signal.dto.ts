import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SignalStatus } from '../enums/signal-status.enum';

export class CreateSignalDto {
    @ApiProperty({ example: 'BTCUSDT' })
    @IsString()
    @IsNotEmpty()
    symbol: string;

    @ApiProperty({ example: 'BINANCE' })
    @IsString()
    @IsNotEmpty()
    exchange: string;

    @ApiProperty({ example: 40000 })
    @IsNumber()
    entry_price: number;

    @ApiProperty({ example: 40000 })
    @IsNumber()
    @IsOptional()
    entry_price_min?: number;

    @ApiProperty({ example: 40000 })
    @IsNumber()
    @IsOptional()
    entry_price_max?: number;

    @ApiProperty({ example: 40500 })
    @IsNumber()
    @IsOptional()
    price_base: number;

    @ApiProperty({ example: '2024-01-27T10:00:00.000Z', required: false })
    @IsDateString()
    @IsOptional()
    entry_date?: string;

    @ApiProperty({ example: 38000 })
    @IsNumber()
    stop_loss_price: number;

    @ApiProperty({ example: 5, required: false, description: 'Stop Loss %' })
    @IsNumber()
    @IsOptional()
    sl_pct?: number;

    @ApiProperty({ example: 42000 })
    @IsNumber()
    tp1_price: number;

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

    @ApiProperty({ example: true, required: false })
    @IsBoolean()
    @IsOptional()
    is_premium?: boolean;

    @ApiProperty({ enum: SignalStatus, default: SignalStatus.ACTIVE, required: false })
    @IsEnum(SignalStatus)
    @IsOptional()
    status?: SignalStatus;

    @ApiProperty({ example: '2024-01-27T09:00:00.000Z', required: false })
    @IsDateString()
    @IsOptional()
    signal_date?: string;

    @ApiProperty({ example: '2024-02-10T00:00:00.000Z', required: false, description: 'Holding period deadline' })
    @IsDateString()
    @IsOptional()
    holding_period?: string;
}
