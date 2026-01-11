import { ApiProperty } from "@nestjs/swagger";
import { SignalDisplayStatus } from "../enums/signal-status.enum";

export class SignalResponseDto {
  @ApiProperty({ example: "09b8d1ee-21ca-4221-b924-9eb47a7cafb1" })
  id: string;

  @ApiProperty({ example: "ACB" })
  symbol: string;

  @ApiProperty({ example: "HNX" })
  exchange: string;

  @ApiProperty({ example: 38.42 })
  price_base: number;

  @ApiProperty({ example: 38.42 })
  current_price: number;

  @ApiProperty({ example: 2.0 })
  current_change_percent: number;

  @ApiProperty({ example: "05/11/2025" })
  signal_date: Date;

  @ApiProperty({ example: "PENDING || ACTIVE || CLOSED" })
  status: string;

  @ApiProperty({
    enum: SignalDisplayStatus,
    example: SignalDisplayStatus.BUY_ZONE
  })
  status_code: SignalDisplayStatus;

  @ApiProperty({ example: 19.48 })
  expected_profit: number;

  @ApiProperty({ example: 18.8 })
  actual_efficiency: number;

  @ApiProperty({ example: "38.50" })
  entry_price: string;

  @ApiProperty({ example: "38.50" })
  entry_price_min: string;

  @ApiProperty({ example: "39.00" })
  entry_price_max: string;

  @ApiProperty({ example: "38.50 - 39.00" })
  entry_zone: string;

  @ApiProperty({ example: 38.5 })
  tp1: number;

  @ApiProperty({ example: 38.5 })
  tp2: number;

  @ApiProperty({ example: 38.5 })
  tp3: number;

  @ApiProperty({ example: 38.5 })
  stop_loss_price: number;

  @ApiProperty({ example: "2 tuần" })
  holding_time: string;

  @ApiProperty({ example: "false" })
  is_expired: boolean; // false = chưa hết hạn, true = hết hạn
}
