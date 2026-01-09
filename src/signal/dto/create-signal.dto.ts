import { SignalStatus } from "../enums/signal-status.enum";

export class CreateSignalDto {
  symbol: string;
  exchange: string;
  entry_price_min: number;
  entry_price_max?: number;
  stop_loss_price: number;
  tp1_price: number;
  tp2_price: number;
  tp3_price?: number;
  tp1_pct?: number;
  tp2_pct?: number;
  tp3_pct?: number;
  sl_price?: number;
  rr_tp1?: number;
  rr_tp2?: number;
  rr_tp3?: number;
  status?: SignalStatus;
  current_price?: number;
  is_premium?: boolean;
}
