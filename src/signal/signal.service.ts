import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, MoreThanOrEqual } from "typeorm";
import { Signal } from "./entities/signal.entity";
import { SignalResponseDto } from "./dto/signal-response.dto";
import { SignalDisplayStatus, SignalStatus } from "./enums/signal-status.enum";
import moment from "moment";

@Injectable()
export class SignalService {
    constructor(
        @InjectRepository(Signal) private signalsRepository: Repository<Signal>,
    ) { }

    async findAll(query: { page: number; limit: number; duration?: string, currentUser?: any }) {
        const { page, limit, duration } = query;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (duration) {
            const now = moment();
            if (duration === "1M") {
                where.created_at = MoreThanOrEqual(now.subtract(1, 'months').toDate());
            } else if (duration === "3M") {
                where.created_at = MoreThanOrEqual(now.subtract(3, 'months').toDate());
            }
        }

        const [signals, total] = await this.signalsRepository.findAndCount({
            where,
            order: { created_at: "DESC" },
            skip,
            take: limit,
        });

        return {
            data: signals.map((signal) => this.mapToResponse(signal, query.currentUser)),
            meta: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findOne(id: string, currentUser?: any) {
        const signal = await this.signalsRepository.findOne({
            where: { id },
        });
        if (!signal) {
            throw new NotFoundException(`Signal with ID ${id} not found`)
        };
        return {
            data: this.mapToResponse(signal, currentUser)
        };
    }

    private mapToResponse(signal: Signal, currentUser?: any): SignalResponseDto {

        const isGuest = !currentUser;

        const entryMin = Number(signal.entry_price_min);
        const entryMax = Number(signal.entry_price_max || signal.entry_price_min);
        const entryAvg = (entryMin + entryMax) / 2;

        const marketPrice = signal.current_price ? Number(signal.current_price) : 0;

        const tp1 = Number(signal.tp1_price);
        const tp2 = Number(signal.tp2_price);
        const tp3 = Number(signal.tp3_price);
        const sl = Number(signal.stop_loss_price);

        // 1. Lãi kỳ vọng
        // Formula: (Tp3_price - AVG(entry_price))/AVG(entry_price) x 100%
        let expectedProfit = 0;
        if (entryAvg > 0) {
            expectedProfit = ((tp3 - entryAvg) / entryAvg) * 100;
        }

        // 2. Hiệu quả tạm tính
        // Formula: (market_price - AVG(entry_price))/AVG(entry_price) x 100%
        let actualEfficiency = 0;
        if (entryAvg > 0) {
            actualEfficiency = ((marketPrice - entryAvg) / entryAvg) * 100;
        }

        // Handle status
        let statusCode = SignalDisplayStatus.BUY_ZONE;
        const now = new Date();
        const holdDate = signal.holding_period ? new Date(signal.holding_period) : null;

        if (marketPrice <= sl) {
            statusCode = SignalDisplayStatus.STOP_LOSS;
        } else if (marketPrice >= tp3) {
            statusCode = SignalDisplayStatus.TAKE_PROFIT_3;
        } else if (marketPrice >= tp2) {
            statusCode = SignalDisplayStatus.TAKE_PROFIT_2;
        } else if (marketPrice >= tp1) {
            statusCode = SignalDisplayStatus.TAKE_PROFIT_1;
        } else if (holdDate && now > holdDate) {
            statusCode = SignalDisplayStatus.EXPIRED;
        } else {
            statusCode = SignalDisplayStatus.BUY_ZONE;
        }

        // Handle holding time
        let holdingTimeText = 'N/A';
        const startDate = signal.signal_date ? new Date(signal.signal_date) : new Date(signal.created_at);

        if (holdDate && startDate) {
            const diffTime = Math.abs(holdDate.getTime() - startDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays >= 7) {
                const weeks = Math.round(diffDays / 7);
                holdingTimeText = `${weeks} tuần`;
            } else {
                holdingTimeText = `${diffDays} ngày`;
            }
        }

        return {
            id: signal.id,
            symbol: isGuest ? "***" : signal.symbol,
            exchange: signal.exchange,
            price_base: signal.price_base,
            current_price: marketPrice,
            current_change_percent: signal.current_change_percent,
            signal_date: startDate,
            status: signal.status,
            status_code: statusCode,
            expected_profit: Number(expectedProfit.toFixed(2)),
            actual_efficiency: Number(actualEfficiency.toFixed(2)),
            entry_price: entryMin.toLocaleString(),
            entry_price_min: entryMin.toLocaleString(),
            entry_price_max: entryMax.toLocaleString(),
            entry_zone: `${entryMin.toLocaleString()} - ${entryMax.toLocaleString()}`,
            tp1: tp1,
            tp2: tp2,
            tp3: tp3,
            stop_loss_price: sl,
            is_expired: signal.is_expired,
            holding_time: holdingTimeText,
        };
    }

}
