import { ApiProperty } from "@nestjs/swagger";

export class SignalResponseDto {
  @ApiProperty({ example: "ACB" })
  symbol: string;

  @ApiProperty({ example: 38.42 })
  current_price: number;

  @ApiProperty({ example: 2.0 })
  change_percent: number;

  @ApiProperty({ example: "05/11/2025" })
  publish_date: string;

  @ApiProperty({ example: "Vùng mua" })
  status_text: string;

  @ApiProperty({ example: 19.48 })
  expected_profit: number;

  @ApiProperty({ example: 18.8 })
  efficiency: number;

  @ApiProperty({ example: "38.50 - 39.00" })
  entry_zone: string;

  @ApiProperty({ example: 38.5 })
  tp1: number;

  @ApiProperty({ example: 38.5 })
  tp2: number;

  @ApiProperty({ example: 38.5 })
  tp3: number;

  @ApiProperty({ example: "2 tuần" })
  holding_time: string;

  @ApiProperty({ example: "Nắm giữ" })
  action_text: string;
}
