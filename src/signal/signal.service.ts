import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, MoreThanOrEqual } from "typeorm";
import { Signal } from "./entities/signal.entity";
import { SignalResponseDto } from "./dto/signal-response.dto";
import { SignalDisplayStatus, SignalStatus } from "./enums/signal-status.enum";
import moment from "moment";
import { UserFavorite } from "./entities/user-favorite.entity";

@Injectable()
export class SignalService {
    constructor(
        @InjectRepository(Signal) private signalsRepository: Repository<Signal>,
        @InjectRepository(UserFavorite) private favoriteRepository: Repository<UserFavorite>,
    ) { }

    async findAll(query: { page: number; limit: number; duration?: string, currentUser?: any }) {
        const { page, limit, duration, currentUser } = query;
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

        let favoritedSignalIds = new Set<string>();
        if (currentUser) {
            const favorites = await this.favoriteRepository.find({
                where: { user_id: currentUser.id },
                select: ['signal_id']
            });
            favorites.forEach(f => favoritedSignalIds.add(f.signal_id));
        }

        return {
            data: signals.map((signal) => this.mapToResponse(signal, currentUser, favoritedSignalIds.has(signal.id))),
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

        let isFavorited = false;
        if (currentUser) {
            const fav = await this.favoriteRepository.findOne({
                where: { user_id: currentUser.id, signal_id: id }
            });
            isFavorited = !!fav;
        }

        return {
            data: this.mapToResponse(signal, currentUser, isFavorited)
        };
    }

    private mapToResponse(signal: Signal, currentUser?: any, isFavorited: boolean = false): SignalResponseDto {

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
            symbol: isGuest ? null : signal.symbol,
            exchange: signal.exchange,
            price_base: isGuest ? null : signal.price_base,
            current_price: isGuest ? null : marketPrice,
            current_change_percent: isGuest ? null : signal.current_change_percent,
            signal_date: startDate,
            status: signal.status,
            status_code: statusCode,
            expected_profit: Number(expectedProfit.toFixed(2)),
            actual_efficiency: Number(actualEfficiency.toFixed(2)),
            entry_price: isGuest ? null : entryMin.toLocaleString(),
            entry_price_min: isGuest ? null : entryMin.toLocaleString(),
            entry_price_max: isGuest ? null : entryMax.toLocaleString(),
            entry_zone: isGuest ? null : `${entryMin.toLocaleString()} - ${entryMax.toLocaleString()}`,
            tp1: isGuest ? null : tp1,
            tp2: isGuest ? null : tp2,
            tp3: isGuest ? null : tp3,
            stop_loss_price: isGuest ? null : sl,
            is_expired: signal.is_expired,
            holding_time: isGuest ? null : holdingTimeText,
            is_favorited: isFavorited
        };
    }

    async toggleFavorite(signalId: string, userId: string) {
        const signal = await this.signalsRepository.findOne({
            where: { id: signalId }
        });
        if (!signal) throw new NotFoundException('Signal not found');

        const existing = await this.favoriteRepository.findOne({
            where: { user_id: userId, signal_id: signalId }
        });

        if (existing) {
            await this.favoriteRepository.remove(existing);
            return { message: 'Removed from watchlist', is_favorited: false };
        } else {
            const newFav = this.favoriteRepository.create({
                user_id: userId,
                signal_id: signalId
            });
            await this.favoriteRepository.save(newFav);
            return { message: 'Added to watchlist', is_favorited: true };
        }
    }

    async getWatchlist(userId: string, page: number = 1, limit: number = 10) {
        console.log(userId);
        const skip = (page - 1) * limit;

        const [favorites, total] = await this.favoriteRepository.findAndCount({
            where: { user_id: userId },
            relations: ['signal'],
            order: { created_at: 'DESC' },
            skip,
            take: limit
        });

        const signals = favorites
            .filter(fav => fav.signal != null)
            .map(fav => fav.signal);

        const data = signals.map(signal => this.mapToResponse(signal, { id: userId }, true));

        return {
            data,
            meta: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit),
            }
        };
    }

}
