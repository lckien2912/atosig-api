import { SignalFinancials } from './signal-financials.entity';

export class Signal {
    id: number;
    symbol: string;
    tradingViewSymbol: string; // e.g. "HOSE:ACB"
    full_name: string;
    description: string;
    image_url?: string;

    // Trading Info
    current_price: number;
    entry_zone_min: number;
    entry_zone_max: number;
    expected_profit: number; // percentage
    holding_time: string;

    stop_loss: number;
    take_profit_1: number;
    take_profit_2: number;
    take_profit_3?: number;

    // Status/Progress
    status_message: string; // e.g., "Đã đạt TP1"
    remaining_to_next_tp?: number; // e.g., 2.36
    progress: number; // 0-100 for the progress bar

    financials: SignalFinancials;

    created_at: Date;
}
