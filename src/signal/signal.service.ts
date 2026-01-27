import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Signal } from "./entities/signal.entity";
import { SignalResponseDto } from "./dto/signal-response.dto";
import { CreateSignalDto } from "./dto/create-signal.dto";
import { SignalDisplayStatus, SignalStatus } from "./enums/signal-status.enum";
import moment from "moment";
import { UserFavorite } from "./entities/user-favorite.entity";
import { User } from "src/users/entities/user.entity";
import { UserSubscriptionTier } from "src/users/enums/user-status.enum";
import { MetricsResponseDto } from "./dto/metrics-response.dto";
import path from "path";
import * as fs from 'fs';

@Injectable()
export class SignalService {
    constructor(
        @InjectRepository(Signal) private signalsRepository: Repository<Signal>,
        @InjectRepository(UserFavorite) private favoriteRepository: Repository<UserFavorite>,
    ) { }

    async findAll(query: { page: number; limit: number; duration?: string, currentUser?: User }) {
        const { page, limit, duration, currentUser } = query;
        const skip = (page - 1) * limit;

        const queryBuilder = this.signalsRepository.createQueryBuilder("signal");

        if (duration) {
            const now = moment();
            if (duration === "1M") {
                queryBuilder.where("signal.created_at >= :fromDate", { fromDate: now.subtract(1, 'months').toDate() });
            } else if (duration === "3M") {
                queryBuilder.where("signal.created_at >= :fromDate", { fromDate: now.subtract(3, 'months').toDate() });
            }
        }

        // Sort: Active/Pending first, then Closed
        queryBuilder.orderBy(`
            CASE 
                WHEN signal.status IN ('ACTIVE', 'PENDING') THEN 1 
                ELSE 2 
            END
        `, "ASC");

        queryBuilder.addOrderBy("signal.created_at", "DESC");

        queryBuilder.skip(skip).take(limit);

        const [signals, total] = await queryBuilder.getManyAndCount();

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

    async geTradingMetrics(): Promise<MetricsResponseDto> {
        let backtestData: any = {};

        try {
            const filePath = path.join(process.cwd(), 'backtest_summary.json');

            if (fs.existsSync(filePath)) {
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                const json = JSON.parse(fileContent);
                backtestData = json['Top1'] || {};
            } else {
                console.log('File backtest_summary.json not found');
            }
        } catch (error) {
            console.log(error);
        }

        const winRate = (backtestData.win_rate || 0) * 100;
        const profitFactor = backtestData.profit_factor || 0;
        const avgProfitPerTrade = (backtestData.avg_return || 0) * 100;

        const queryBuilder = this.signalsRepository.createQueryBuilder('signal');

        const totalSignals = await queryBuilder.getCount();

        const { maxDrawdownVal } = await queryBuilder
            .select('MAX(((signal.entry_price_min - signal.stop_loss_price) / signal.entry_price_min) * 100)', 'maxDrawdownVal')
            .where('signal.entry_price_min > 0')
            .getRawOne();

        const { avgHoldingSeconds } = await queryBuilder
            .select('AVG(EXTRACT(EPOCH FROM (signal.holding_period::timestamp - signal.entry_date::timestamp)))', 'avgHoldingSeconds')
            .where('signal.holding_period IS NOT NULL')
            .andWhere('signal.entry_date IS NOT NULL')
            .getRawOne();

        const avgHoldingDays = avgHoldingSeconds ? parseFloat(avgHoldingSeconds) / 86400 : 0;

        return {
            winRate: Number(winRate.toFixed(2)),
            profitFactor: Number(profitFactor.toFixed(2)),
            avgProfit: Number(avgProfitPerTrade.toFixed(2)),
            totalSignals: totalSignals,
            avgHoldingTime: Math.round(avgHoldingDays).toString(),
            maxStopLossPct: maxDrawdownVal ? -Number(Number(maxDrawdownVal).toFixed(2)) : 0,
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

    private mapToResponse(signal: Signal, currentUser?: User, isFavorited: boolean = false): SignalResponseDto {
        const isPaidUser = currentUser && currentUser.subscription_tier !== UserSubscriptionTier.FREE;
        const isLocked = !isPaidUser && signal.status !== SignalStatus.CLOSED;

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
        let closeTime: Date | null = null;

        if (marketPrice <= sl) {
            statusCode = SignalDisplayStatus.STOP_LOSS;
            closeTime = signal.sl_hit_at || null;
        } else if (marketPrice >= tp3) {
            statusCode = SignalDisplayStatus.TAKE_PROFIT_3;
            closeTime = signal.tp3_hit_at || null;
        } else if (marketPrice >= tp2) {
            statusCode = SignalDisplayStatus.TAKE_PROFIT_2;
            closeTime = signal.tp2_hit_at || null;
        } else if (marketPrice >= tp1) {
            statusCode = SignalDisplayStatus.TAKE_PROFIT_1;
            closeTime = signal.tp1_hit_at || null;
        } else if (holdDate && now > holdDate) {
            statusCode = SignalDisplayStatus.EXPIRED;
            closeTime = holdDate;
        } else {
            statusCode = SignalDisplayStatus.BUY_ZONE;
            closeTime = null;
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
            symbol: isLocked ? null : signal.symbol,
            exchange: signal.exchange,
            price_base: isLocked ? null : signal.price_base,
            current_price: isLocked ? null : marketPrice,
            current_change_percent: isLocked ? null : signal.current_change_percent,
            signal_date: startDate,
            status: signal.status,
            status_code: statusCode,
            expected_profit: Number(expectedProfit.toFixed(2)),
            actual_efficiency: Number(actualEfficiency.toFixed(2)),
            entry_price: isLocked ? null : entryMin,
            entry_price_min: isLocked ? null : entryMin,
            entry_price_max: isLocked ? null : entryMax,
            entry_zone: isLocked ? null : `${entryMin} - ${entryMax}`,
            tp1: isLocked ? null : tp1,
            tp2: isLocked ? null : tp2,
            tp3: isLocked ? null : tp3,
            stop_loss_price: isLocked ? null : sl,
            is_expired: signal.is_expired,
            holding_time: isLocked ? null : holdingTimeText,
            is_favorited: isFavorited,
            close_time: closeTime,
            tp1_hit_at: isLocked ? null : signal.tp1_hit_at,
            tp2_hit_at: isLocked ? null : signal.tp2_hit_at,
            tp3_hit_at: isLocked ? null : signal.tp3_hit_at,
            sl_hit_at: isLocked ? null : signal.sl_hit_at,
            closed_at: isLocked ? null : signal.closed_at
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

    async getWatchlist(currentUser: User, page: number = 1, limit: number = 10) {
        const skip = (page - 1) * limit;

        const [favorites, total] = await this.favoriteRepository.findAndCount({
            where: { user_id: currentUser.id },
            relations: ['signal'],
            order: { created_at: 'DESC' },
            skip,
            take: limit
        });

        const signals = favorites
            .filter(fav => fav.signal != null)
            .map(fav => fav.signal);

        const data = signals.map(signal => this.mapToResponse(signal, currentUser, true));

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

    async findAllForAdmin(query: {
        page: number;
        limit: number;
        symbol?: string;
        status?: string
    }) {
        const { page, limit, symbol, status } = query;
        const skip = (page - 1) * limit;

        const queryBuilder = this.signalsRepository.createQueryBuilder('signal');

        if (symbol) {
            queryBuilder.andWhere('signal.symbol ILIKE :symbol', { symbol: `%${symbol}%` });
        }

        if (status) {
            queryBuilder.andWhere('signal.status = :status', { status });
        }

        queryBuilder.orderBy('signal.created_at', 'DESC');

        queryBuilder.skip(skip).take(limit);

        const [data, total] = await queryBuilder.getManyAndCount();

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

    async findOneForAdmin(id: string) {
        const signal = await this.signalsRepository.findOne({
            where: { id }
        });

        if (!signal) {
            throw new NotFoundException(`Signal with ID ${id} not found`);
        }

        return signal;
    }

    async deleteSignal(signalId: string) {
        const signal = await this.signalsRepository.findOne({ where: { id: signalId } });
        if (!signal) throw new NotFoundException(`Không tìm thấy signal với id ${signalId}`);

        await this.signalsRepository.remove(signal);
        return { message: 'Signal deleted succussfully' };
    }

    async create(dto: CreateSignalDto) {
        const entryMin = dto.entry_price_min || dto.entry_price;
        const entryMax = dto.entry_price_max || dto.entry_price;
        const entryAvg = (entryMin + entryMax) / 2;
        const priceBase = dto.price_base;

        const sl = dto.stop_loss_price;
        const tp1 = dto.tp1_price;
        const tp2 = dto.tp2_price || 0;
        const tp3 = dto.tp3_price || 0;

        const stop_loss_pct = dto.sl_pct || 0;

        const tp1_pct = dto.tp1_pct || 0;
        const tp2_pct = dto.tp2_pct || 0;
        const tp3_pct = dto.tp3_pct || 0;

        const rr_tp1 = dto.tp1_pct || 0;
        const rr_tp2 = dto.tp2_pct || 0;
        const rr_tp3 = dto.tp3_pct || 0;

        const signal = this.signalsRepository.create({
            ...dto,
            price_base: priceBase,
            entry_price_min: entryMin,
            entry_price_max: entryMax,
            signal_date: dto.signal_date ? new Date(dto.signal_date) : new Date(),
            entry_date: dto.entry_date ? new Date(dto.entry_date) : new Date(),
            stop_loss_price: sl,
            tp1_price: tp1,
            tp2_price: tp2,
            tp3_price: tp3,
            stop_loss_pct,
            tp1_pct,
            tp2_pct,
            tp3_pct,
            rr_tp1,
            rr_tp2,
            rr_tp3,
            atr_pct: dto.atr_pct || 0,
            status: SignalStatus.ACTIVE,
            is_premium: dto.is_premium ?? true,
            is_notified: false,
            is_expired: false,
            holding_period: dto.holding_period || moment(dto.signal_date).add(10, 'days').toDate(),
        });

        return this.signalsRepository.save(signal);
    }
}
