import { ApiProperty } from "@nestjs/swagger";
import { SignalDisplayStatus } from "../enums/signal-status.enum";

export class SignalResponseDto {
  @ApiProperty({ example: "09b8d1ee-21ca-4221-b924-9eb47a7cafb1" })
  id: string;

  @ApiProperty({ example: "ACB", nullable: true })
  symbol: string | null;

  @ApiProperty({ example: "HNX" })
  exchange: string;

  @ApiProperty({ example: 38400, nullable: true })
  price_base: number | null;

  @ApiProperty({ example: 38420, nullable: true })
  current_price: number | null;

  @ApiProperty({ example: 2.0, nullable: true })
  current_change_percent: number | null;

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

  @ApiProperty({ example: 38500, nullable: true })
  entry_price: number | null;

  @ApiProperty({ example: 38500, nullable: true })
  entry_price_min: number | null;

  @ApiProperty({ example: 39000, nullable: true })
  entry_price_max: number | null;

  @ApiProperty({ example: "38.50 - 39.00", nullable: true })
  entry_zone: string | null;

  @ApiProperty({ example: 38.5, nullable: true })
  tp1: number | null;

  @ApiProperty({ example: 38.5, nullable: true })
  tp1_pct: number | null;

  @ApiProperty({ example: 38.5, nullable: true })
  tp2_pct: number | null;

  @ApiProperty({ example: 38.5, nullable: true })
  tp3_pct: number | null;

  @ApiProperty({ example: 38.5, nullable: true })
  stop_loss_pct: number | null;

  @ApiProperty({ example: 38.5, nullable: true })
  tp2: number | null;

  @ApiProperty({ example: 38.5, nullable: true })
  tp3: number | null;

  @ApiProperty({ example: 38.5, nullable: true })
  stop_loss_price: number | null;

  @ApiProperty({ example: "2 tuần", nullable: true })
  holding_time: string | null;

  @ApiProperty({ example: "false" })
  is_expired: boolean; // false = chưa hết hạn, true = hết hạn

  @ApiProperty({ example: "false" })
  is_favorited: boolean;

  @ApiProperty({ example: "2025-11-05T10:30:22.000Z", nullable: true })
  close_time: Date | null;

  @ApiProperty({ example: "2025-11-05T10:30:22.000Z", nullable: true })
  tp1_hit_at: Date | null;

  @ApiProperty({ example: "2025-11-05T10:30:22.000Z", nullable: true })
  tp2_hit_at: Date | null;

  @ApiProperty({ example: "2025-11-05T10:30:22.000Z", nullable: true })
  tp3_hit_at: Date | null;

  @ApiProperty({ example: "2025-11-05T10:30:22.000Z", nullable: true })
  sl_hit_at: Date | null;

  @ApiProperty({ example: "2025-11-05T10:30:22.000Z", nullable: true })
  closed_at: Date | null;
}
