import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Signal } from "./entities/signal.entity";
import { SignalResponseDto } from "./dto/signal-response.dto";
import { CreateSignalDto } from "./dto/create-signal.dto";
import { SignalDisplayStatus, SignalStatus } from "./enums/signal-status.enum";
import moment from "moment";
import { UserFavorite } from "./entities/user-favorite.entity";
import { User } from "src/users/entities/user.entity";
import { UserSubscriptionTier } from "src/users/enums/user-status.enum";
import { MetricsResponseDto } from "./dto/metrics-response.dto";
import { MetricsFilterDto } from "./dto/metrics-filter.dto";
import { ProfitFactorFilterDto } from "./dto/profit-factor-filter.dto";
import { ProfitFactorResponseDto, MonthlyProfitFactorDto } from "./dto/profit-factor-response.dto";
import { SignalListFilterDto } from "./dto/signal-list-filter.dto";

@Injectable()
export class SignalService {
    constructor(
        @InjectRepository(Signal) private signalsRepository: Repository<Signal>,
        @InjectRepository(UserFavorite) private favoriteRepository: Repository<UserFavorite>,
    ) { }

    async findAll(query: SignalListFilterDto & { currentUser?: User }) {
        const { page = 1, limit = 10, startDate, endDate, currentUser } = query;
        const skip = (page - 1) * limit;

        const queryBuilder = this.signalsRepository.createQueryBuilder("signal");

        if (startDate) {
            queryBuilder.andWhere("signal.signal_date >= :startDate", { startDate });
        }
        if (endDate) {
            queryBuilder.andWhere("signal.signal_date <= :endDate", { endDate });
        }

        // Sort: Active/Pending first, then Closed
        queryBuilder.orderBy(`
            CASE 
                WHEN signal.status IN ('ACTIVE', 'PENDING') THEN 1 
                ELSE 2 
            END
        `, "ASC");

        // Sort Active signals by actualEfficiency DESC (higher efficiency first)
        queryBuilder.addOrderBy(
            `
            CASE 
                WHEN signal.status IN ('ACTIVE', 'PENDING') 
                THEN ((signal.current_price - (signal.entry_price_min + signal.entry_price_max) / 2.0) / 
                      ((signal.entry_price_min + signal.entry_price_max) / 2.0)) * 100
                ELSE -999999
            END
        `,
            'DESC'
        );

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

    async getTradingMetrics(filter: MetricsFilterDto): Promise<MetricsResponseDto> {
        const queryBuilder = this.signalsRepository.createQueryBuilder('signal');

        if (filter.startDate) {
            queryBuilder.andWhere('signal.signal_date >= :startDate', { startDate: filter.startDate });
        }
        if (filter.endDate) {
            queryBuilder.andWhere('signal.signal_date <= :endDate', { endDate: filter.endDate });
        }

        const signals = await queryBuilder.getMany();
        const totalSignals = signals.length;
        const closedSignals = signals.filter(signal => signal.status === SignalStatus.CLOSED);
        const totalClosedSignals = closedSignals.length;

        if (totalSignals === 0) {
            return {
                winRate: 0,
                avgProfit: 0,
                totalSignals: 0,
                avgHoldingTime: 0,
                maxDrawdown: 0,
                maxProfit: 0,
                minProfit: 0,
            };
        }

        const efficiencies = closedSignals.map(signal => this.calculateActualEfficiency(signal));
        const maxProfit = Math.max(...efficiencies);
        const minProfit = Math.min(...efficiencies);
        const maxDrawdown = Math.min(...efficiencies, 0);
        const profitableSignals = closedSignals.filter(s => s.tp1_hit_at !== null).length;
        const winRate = (profitableSignals / totalClosedSignals) * 100;

        const sumEfficiency = efficiencies.reduce((acc, val) => acc + val, 0);
        const avgProfit = sumEfficiency / totalClosedSignals;


        const holdingDays = signals.map(signal => this.calculateHoldingDays(signal));
        const avgHoldingTime = Math.round(holdingDays.reduce((acc, val) => acc + val, 0) / totalSignals);

        return {
            winRate: Number(winRate.toFixed(2)),
            avgProfit: Number(avgProfit.toFixed(2)),
            totalSignals,
            avgHoldingTime,
            maxDrawdown: Number(maxDrawdown.toFixed(2)),
            maxProfit: Number(maxProfit.toFixed(2)),
            minProfit: Number(minProfit.toFixed(2)),
        };
    }

    private calculateEntryAvg = (signal: Signal): number => {
        const entryMin = Number(signal.entry_price_min);
        const entryMax = Number(signal.entry_price_max || signal.entry_price_min);
        return (entryMin + entryMax) / 2;
    };

    private calculatePercentages = (signal: Signal, entryAvg: number) => {
        const tp1 = Number(signal.tp1_price);
        const tp2 = Number(signal.tp2_price);
        const tp3 = Number(signal.tp3_price);
        const sl = Number(signal.stop_loss_price);
        return {
            tp1_pct: entryAvg > 0 ? ((tp1 - entryAvg) / entryAvg) * 100 : 0,
            tp2_pct: entryAvg > 0 ? ((tp2 - entryAvg) / entryAvg) * 100 : 0,
            tp3_pct: entryAvg > 0 ? ((tp3 - entryAvg) / entryAvg) * 100 : 0,
            sl_pct: entryAvg > 0 ? ((entryAvg - sl) / entryAvg) * 100 : 0,
        };
    };

    private calculateActualEfficiency = (signal: Signal): number => {
        const entryAvg = this.calculateEntryAvg(signal);
        const marketPrice = signal.current_price ? Number(signal.current_price) : 0;

        if (entryAvg === 0) return 0;

        const { tp1_pct, tp2_pct, tp3_pct, sl_pct } = this.calculatePercentages(signal, entryAvg);
        const tp1 = Number(signal.tp1_price);
        const tp2 = Number(signal.tp2_price);
        const tp3 = Number(signal.tp3_price);
        const sl = Number(signal.stop_loss_price);

        // For CLOSED signals
        if (signal.status === SignalStatus.CLOSED) {
            if (signal.tp3_hit_at) return tp3_pct;
            if (signal.tp2_hit_at) return tp2_pct;
            if (signal.tp1_hit_at) return tp1_pct;
            if (signal.sl_hit_at) return sl_pct;
            return ((marketPrice - entryAvg) / entryAvg) * 100;
        }

        // For ACTIVE/PENDING signals - use current market price
        // But respect TP hits that already happened
        if (marketPrice < tp3 && signal.tp3_hit_at) return tp3_pct;
        if (marketPrice < tp2 && signal.tp2_hit_at) return tp2_pct;
        if (marketPrice < tp1 && signal.tp1_hit_at) return tp1_pct;
        return ((marketPrice - entryAvg) / entryAvg) * 100;
    };

    private calculateHoldingDays = (signal: Signal): number => {
        const startDate = signal.signal_date
            ? moment(signal.signal_date)
            : moment(signal.created_at);
            const endDate = moment(signal.holding_period)
        return Math.ceil(endDate.diff(startDate, 'days', true));
    };

    /**
     * Get Profit Factor metrics with monthly chart data
     * PF = Sum(positive actualEfficiency) / Sum(abs(negative actualEfficiency))
     */
    async getProfitFactor(filter: ProfitFactorFilterDto): Promise<ProfitFactorResponseDto> {
        const year = filter.year || moment().year();

        const startOfYear = moment().year(year).month(0).date(1).startOf('day').toDate();
        const endOfYear = moment().year(year).month(11).date(31).endOf('day').toDate();

        const signals = await this.signalsRepository.createQueryBuilder('signal')
            .where('signal.signal_date >= :startOfYear', { startOfYear })
            .andWhere('signal.signal_date <= :endOfYear', { endOfYear })
            .andWhere('signal.status = :status', { status: SignalStatus.CLOSED })
            .getMany();

        const monthlySignals = this.groupSignalsByMonth(signals, year);

        const monthlyData: MonthlyProfitFactorDto[] = [];
        let latestMonthWithData: MonthlyProfitFactorDto | null = null;

        for (let month = 1; month <= 12; month++) {
            const monthKey = `${month.toString().padStart(2, '0')}-${year}`;
            const monthSignals = monthlySignals.get(monthKey) || [];

            const efficiencies = monthSignals.map(s => this.calculateActualEfficiency(s));

            const grossProfit = efficiencies
                .filter(e => e > 0)
                .reduce((acc, val) => acc + val, 0);

            const grossLoss = efficiencies
                .filter(e => e < 0)
                .reduce((acc, val) => acc + Math.abs(val), 0);

            const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? grossProfit : 0);

            const monthData: MonthlyProfitFactorDto = {
                month: monthKey,
                profitFactor: Number(profitFactor.toFixed(2)),
                grossProfit: Number(grossProfit.toFixed(2)),
                grossLoss: Number(grossLoss.toFixed(2))
            };

            monthlyData.push(monthData);

            if (monthSignals.length > 0) {
                latestMonthWithData = monthData;
            }
        }

        const highlightedPF = latestMonthWithData?.profitFactor || 0;

        return {
            profitFactor: highlightedPF,
            monthlyData
        };
    }

    private groupSignalsByMonth = (signals: Signal[], year: number): Map<string, Signal[]> => {
        const map = new Map<string, Signal[]>();

        // Initialize all 12 months
        for (let m = 1; m <= 12; m++) {
            const key = `${m.toString().padStart(2, '0')}-${year}`;
            map.set(key, []);
        }

        // Group signals
        signals.forEach(signal => {
            const signalDate = signal.signal_date
                ? moment(signal.signal_date)
                : moment(signal.created_at);
            if (signalDate.year() === year) {
                const key = `${(signalDate.month() + 1).toString().padStart(2, '0')}-${year}`;
                const existing = map.get(key) || [];
                existing.push(signal);
                map.set(key, existing);
            }
        });

        return map;
    };

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
        const entryAvg = this.calculateEntryAvg(signal);

        const marketPrice = signal.current_price ? Number(signal.current_price) : 0;

        const tp1 = Number(signal.tp1_price);
        const tp2 = Number(signal.tp2_price);
        const tp3 = Number(signal.tp3_price);
        const sl = Number(signal.stop_loss_price);

        // 1. Lãi kỳ vọng
        // Formula: (Tp3_price - AVG(entry_price))/AVG(entry_price) x 100%
        const expectedProfit = entryAvg > 0 ? ((tp3 - entryAvg) / entryAvg) * 100 : 0;

        const actualEfficiency = this.calculateActualEfficiency(signal);
        const { tp1_pct, tp2_pct, tp3_pct, sl_pct } = this.calculatePercentages(signal, entryAvg);

        // Handle status
        let statusCode = 0;
        const now = moment();
        const holdDate = signal.holding_period ? moment(signal.holding_period) : null;
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
        } else if (holdDate && now.isAfter(holdDate)) {
            statusCode = SignalDisplayStatus.EXPIRED;
            closeTime = holdDate.toDate();
        } else if (marketPrice >= signal.entry_price_min && marketPrice <= signal.entry_price_max) {
            statusCode = SignalDisplayStatus.BUY_ZONE;
            closeTime = null;
        }

        // Handle holding time
        let holdingTimeText = 'N/A';
        const startDate = signal.signal_date
            ? moment(signal.signal_date)
            : moment(signal.created_at);

        if (holdDate && startDate) {
            const diffDays = Math.ceil(holdDate.diff(startDate, 'days', true));

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
            signal_date: startDate.toDate(),
            status: signal.status,
            status_code: statusCode,
            expected_profit: expectedProfit,
            actual_efficiency: actualEfficiency,
            entry_price: isLocked ? null : entryAvg,
            entry_price_min: isLocked ? null : entryMin,
            entry_price_max: isLocked ? null : entryMax,
            entry_zone: isLocked ? null : `${entryMin} - ${entryMax}`,
            tp1: isLocked ? null : tp1,
            tp1_pct: isLocked ? null : tp1_pct,
            tp2: isLocked ? null : tp2,
            tp2_pct: isLocked ? null : tp2_pct,
            tp3: isLocked ? null : tp3,
            tp3_pct: isLocked ? null : tp3_pct,
            stop_loss_price: isLocked ? null : sl,
            stop_loss_pct: isLocked ? null : sl_pct,
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
