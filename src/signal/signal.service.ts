import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Signal } from "./entities/signal.entity";
import { SignalResponseDto } from "./dto/signal-response.dto";
import { SignalStatus } from "./enums/signal-status.enum";

@Injectable()
export class SignalService {
    constructor(
        @InjectRepository(Signal) private signalsRepository: Repository<Signal>,
    ) { }

    async findAll(query: { page: number; limit: number; duration?: string }) {
        const { page, limit, duration } = query;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (duration) {
            const now = new Date();
            let pastDate = new Date();
            if (duration === "1M") {
                pastDate.setMonth(now.getMonth() - 1);
            } else if (duration === "3M") {
                pastDate.setMonth(now.getMonth() - 3);
            }

            // Filter by created_at or signal_date
            // Using MoreThanOrEqual from typeorm
            const { MoreThanOrEqual } = require("typeorm");
            where.created_at = MoreThanOrEqual(pastDate);
        }

        const [signals, total] = await this.signalsRepository.findAndCount({
            where,
            order: { created_at: "DESC" },
            skip,
            take: limit,
        });

        return {
            data: signals.map((signal) => this.mapToResponse(signal)),
            meta: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    private mapToResponse(signal: Signal): SignalResponseDto {
        // 1. Calculate Average Entry Price
        const entryMin = Number(signal.entry_price_min);
        const entryMax = Number(signal.entry_price_max || signal.entry_price_min);
        const entryAvg = (entryMin + entryMax) / 2;

        // 2. Determine Market Price (Current Price or Price Base)
        const marketPrice =
            signal.current_price !== undefined && signal.current_price !== null
                ? Number(signal.current_price)
                : Number(signal.price_base);

        // 3. Calculate Efficiency (Actual Efficiency)
        // Formula: (market_price - AVG(entry_price))/AVG(entry_price) x 100%
        let efficiency = 0;
        if (entryAvg !== 0) {
            efficiency = ((marketPrice - entryAvg) / entryAvg) * 100;
        }

        // 4. Calculate Expected Profit
        // Formula: (Tp3_price - AVG(entry_price))/AVG(entry_price) x 100%
        const tp3 = Number(signal.tp3_price);
        let expectedProfit = 0;
        if (entryAvg !== 0) {
            expectedProfit = ((tp3 - entryAvg) / entryAvg) * 100;
        }

        // 5. Holding Time Calculation
        // Formula: holding_period - signal_date
        let holdingTime = "";
        const startDate = signal.signal_date ? new Date(signal.signal_date) : (signal.created_at ? new Date(signal.created_at) : null);

        if (signal.holding_period && startDate) {
            const end = new Date(signal.holding_period);
            const diffTime = end.getTime() - startDate.getTime();
            const diffDays = Math.max(0, diffTime / (1000 * 3600 * 24));

            const weeks = Math.round(diffDays / 7);
            if (weeks >= 1) {
                holdingTime = `${weeks} tuần`;
            } else {
                holdingTime = `${Math.ceil(diffDays)} ngày`;
            }
        } else {
            holdingTime = "N/A";
        }

        // 6. Status Text Logic
        let statusText = "Vùng mua";
        const tp1 = Number(signal.tp1_price);
        const tp2 = Number(signal.tp2_price);
        const sl = Number(signal.sl_price || signal.stop_loss_price);

        // Check targets
        if (marketPrice >= tp3) {
            statusText = "TP3";
        } else if (marketPrice >= tp2) {
            statusText = "TP2";
        } else if (marketPrice >= tp1) {
            statusText = "TP1";
        } else if (marketPrice <= sl) {
            statusText = "SL";
        } else if (signal.status === SignalStatus.CLOSED) {
            statusText = "Đóng";
        }

        // Check expiration
        const now = new Date();
        if (signal.holding_period && now > new Date(signal.holding_period)) {
            // If not hit target, maybe mark expired? 
            // Logic: If still "Vùng mua" but time passed -> "Hết hạn"? 
            // Or keep simple status. User requested "trạng thái còn có TP3..."
            // Let's assume hitting target takes precedence over expiry.
            if (statusText === "Vùng mua") {
                statusText = "Hết hạn";
            }
        }

        // Action Text Mapping
        let actionText = "Theo dõi";
        if (statusText === "Vùng mua" || statusText === "TP1" || statusText === "TP2") {
            actionText = "Nắm giữ";
        }
        if (statusText === "SL" || statusText === "TP3" || statusText === "Hết hạn" || statusText === "Đóng") {
            actionText = "Đóng";
        }

        return {
            symbol: signal.symbol,
            current_price: marketPrice,
            change_percent: 2.0, // Mock: Would need realtime market data API
            publish_date: startDate
                ? startDate.toLocaleDateString("en-GB")
                : "",
            status_text: statusText,
            expected_profit: Number(expectedProfit.toFixed(2)),
            efficiency: Number(efficiency.toFixed(2)),
            entry_zone: `${entryMin.toLocaleString()} - ${entryMax.toLocaleString()}`,
            tp1: tp1,
            tp2: tp2,
            tp3: tp3,
            holding_time: holdingTime,
            action_text: actionText,
        };
    }

    async findOne(id: string) {
        const signal = await this.signalsRepository.findOne({
            where: { id },
        });
        if (!signal) return null;
        // Ideally should map this to a detail DTO too, but for now returning entity
        return signal;
    }
}
