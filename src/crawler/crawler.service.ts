import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, MoreThanOrEqual } from "typeorm";
import { lastValueFrom } from "rxjs";
import { Signal } from "../signal/entities/signal.entity";
import { SignalStatus } from "../signal/enums/signal-status.enum";
import moment from "moment";
import { NotificationsService } from "src/notification/notifications.service";
import { NotificationType } from "src/notification/enums/notification.enum";
import { TelegramService } from "src/telegram/telegram.service";

@Injectable()
export class CrawlerService {
    private readonly logger = new Logger(CrawlerService.name);

    // cờ tránh trạng thái job chồng chéo
    private isJobRunning = false;

    private accessToken: string = '';
    private tokenExpiry: number = 0;
    private readonly ssiConfig;

    constructor(
        @InjectRepository(Signal)
        private readonly signalRepository: Repository<Signal>,
        private readonly httpService: HttpService,
        private readonly notiService: NotificationsService,
        private readonly telegramService: TelegramService,
        private readonly configService: ConfigService
    ) {
        this.ssiConfig = {
            authUrl: this.configService.get<string>('SSI_AUTH_URL'),
            priceUrl: this.configService.get<string>('SSI_PRICE_URL'),
            consumerID: this.configService.get<string>('SSI_CONSUMER_ID'),
            consumerSecret: this.configService.get<string>('SSI_CONSUMER_SECRET')
        }
    }

    /**
     * Get Access Token from SSI
     */
    async getAccessToken(): Promise<string> {
        const now = Date.now();

        if (this.accessToken && now < this.tokenExpiry - 5 * 60 * 1000) {
            return this.accessToken;
        }

        try {
            const response = await lastValueFrom(
                this.httpService.post(this.ssiConfig.authUrl, {
                    consumerID: this.ssiConfig.consumerID,
                    consumerSecret: this.ssiConfig.consumerSecret
                })
            );

            if (response.data && 200 === response.data.status) {
                this.accessToken = response.data.data.accessToken;
                this.tokenExpiry = now + 3600 * 1000;
                this.logger.log('SSI Access Token refreshed successfully');
                return this.accessToken;
            } else {
                throw new Error('Failed to get SSI Token');
            }

        } catch (error) {
            this.logger.error('Error getting SSI token', error);
            throw error;
        }
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async scanForNewSignal() {
        if (this.isJobRunning) {
            this.logger.warn('⚠️ Previous scan job is still running. Skipping this tick.');
            return;
        }
        this.isJobRunning = true;

        try {
            const newSignals = await this.signalRepository.find({
                where: {
                    is_notified: false,
                    status: In([SignalStatus.ACTIVE, SignalStatus.PENDING])
                },
                take: 5,
                order: { created_at: 'ASC' }
            });

            if (newSignals.length === 0) {
                this.isJobRunning = false;
                return;
            }

            this.logger.log(`Found ${newSignals.length} new signals to notify!`);

            for (const signal of newSignals) {
                await this.telegramService.sendNewSignal(signal);
                await this.signalRepository.update(signal.id, { is_notified: true });
                await new Promise(r => setTimeout(r, 1000));
            }

        } catch (error) {
            this.logger.error("Error scanning new signals", error);
        } finally {
            this.isJobRunning = false;
        }
    }


    /** 
     * Cronjob 1minute
     * CronExpression.EVERY_MINUTE
     */
    @Cron(CronExpression.EVERY_MINUTE)
    async handleCronUpdatePriceSignal() {

        if (this.isJobRunning) {
            this.logger.warn('⚠️ Previous job is still running. Skipping this tick.');
            return;
        }

        this.isJobRunning = true;
        const startTime = Date.now();

        try {
            this.logger.log('Starting price update job');

            let searchMoment = moment();
            const dayOfWeek = searchMoment.day();
            if (dayOfWeek === 6) searchMoment = searchMoment.subtract(1, 'days');
            else if (dayOfWeek === 0) searchMoment = searchMoment.subtract(2, 'days');

            const today = searchMoment.format('DD/MM/YYYY');

            const signals = await this.signalRepository.find({
                select: ['symbol'],
                where: [
                    { status: SignalStatus.ACTIVE },
                    { status: SignalStatus.PENDING }
                ]
            });

            const uniqueSymbols = [...new Set(signals.map(s => s.symbol))];

            if (uniqueSymbols.length === 0) {
                this.logger.log('No active/pending signals to update');
                return;
            }

            const token = await this.getAccessToken();

            // 2. Xử lý song song (Batch Processing)
            // Chia nhỏ thành các nhóm 20 request một lúc để tránh nghẽn mạng/API limit
            const BATCH_SIZE = 20;
            let successCount = 0;
            for (let i = 0; i < uniqueSymbols.length; i += BATCH_SIZE) {
                const batch = uniqueSymbols.slice(i, i + BATCH_SIZE);

                await Promise.all(
                    batch.map(symbol => this.fetchAndUpdateOne(symbol, token, today)
                        .then(res => { if (res) successCount++; })
                    )
                );

                await new Promise(resolve => setTimeout(resolve, 200));
            }
            const duration = (Date.now() - startTime) / 1000;
            this.logger.log(`Job finished in ${duration}s. Updated ${successCount}/${uniqueSymbols.length} symbols.`);
        } catch (error) {
            this.logger.error('Error in Cron Job', error);
        } finally {
            this.isJobRunning = false;
        }
    }

    /**
     * Cronjob 1hour
     * update is_expired & Close signals that reached holding period
     */
    @Cron('59 23 * * *')
    async handleCronUpdateIsExpired() {
        this.logger.log('--- Checking for expired signals ---');

        try {
            const now = new Date();

            const result = await this.signalRepository
                .createQueryBuilder()
                .update(Signal)
                .set({
                    is_expired: true,
                    status: SignalStatus.CLOSED,
                    closed_at: () => "NOW()"
                })
                .where("is_expired = :isExpired", { isExpired: false })
                .andWhere("holding_period < :now", { now })
                .andWhere("status != :status", { status: SignalStatus.CLOSED })
                .execute();

            if (result.affected && result.affected > 0) {
                this.logger.log(`✅ Auto-expired and CLOSED ${result.affected} signals.`);
            } else {
                this.logger.log('No signals expired this hour.');
            }
        } catch (error) {
            this.logger.error('Error auto-expiring signals', error);
        }
    }

    /**
     * Cronjob Daily Summary (e.g. at 17:00 when market closes or 23:59)
     */
    @Cron('30 17 * * 1-5') // Run at 17:30 Mon-Fri (After market close)
    // @Cron(CronExpression.EVERY_MINUTE)
    async handleCronDailySummary() {
        if (this.isJobRunning) {
            this.logger.warn('⚠️ Summary job is still running. Skipping.');
            return;
        }
        this.isJobRunning = true;

        this.logger.log('--- Generating Daily PnL Summary ---');
        try {
            const todayStr = moment().format('YYYY-MM-DD');
            const startOfDay = moment().startOf('day').toDate();

            const activeSignals = await this.signalRepository.find({
                where: { status: In([SignalStatus.ACTIVE, SignalStatus.PENDING]) }
            });

            const closedSignals = await this.signalRepository.find({
                where: {
                    status: SignalStatus.CLOSED,
                    closed_at: MoreThanOrEqual(startOfDay)
                }
            });

            const allSignals = [...activeSignals, ...closedSignals];

            if (allSignals.length === 0) {
                this.logger.log('No signals to summarize.');
                return;
            }

            let profitList: string[] = [];
            let lossList: string[] = [];
            let totalProfit = 0;

            for (const signal of allSignals) {
                const highestPrice = Number(signal.highest_price);
                const entryMin = Number(signal.entry_price_min);
                const entryMax = Number(signal.entry_price_max || signal.entry_price_min);
                const entryAvg = (entryMin + entryMax) / 2;

                if (entryAvg === 0 || highestPrice === 0) continue;

                const pnl = ((highestPrice - entryAvg) / entryAvg) * 100;
                totalProfit += pnl;

                const isClosed = signal.status === SignalStatus.CLOSED;
                const statusSuffix = isClosed ? ' (Position closed)' : '';
                const icon = (isClosed && pnl > 0) ? ' ✅✅✅' : '';

                const line = `${signal.symbol}: ${pnl.toFixed(2)}%${statusSuffix}${icon}`;

                if (pnl >= 0) {
                    profitList.push(line);
                } else {
                    lossList.push(line);
                }
            }

            let message = `Summary of profit/loss to date (${todayStr}):\n`;

            message += `💹\n`;
            if (profitList.length > 0) {
                message += profitList.join('\n') + '\n';
            } else {
                message += '(None)\n';
            }

            message += `🛑\n`;
            if (lossList.length > 0) {
                message += lossList.join('\n') + '\n';
            } else {
                message += '(None)\n';
            }

            message += `💹\n`;
            message += `Profit: ${totalProfit.toFixed(2)}%`;

            await this.telegramService.sendDailySummary(message);
            this.logger.log('Daily Summary Sent to Telegram');

        } catch (error) {
            this.logger.error('Error generating daily summary', error);
        } finally {
            this.isJobRunning = false;
        }
    }

    private async fetchAndUpdateOne(symbol: string, token: string, dateStr: string): Promise<boolean> {
        try {
            // config request ssi -> crawls[0]
            const url = this.ssiConfig.priceUrl;
            const headers = {
                Authorization: `Bearer ${token}`
            };
            const params = {
                Symbol: symbol,
                FromDate: dateStr,
                ToDate: dateStr,
                PageIndex: 1,
                PageSize: 10
            };

            const response = await lastValueFrom(
                this.httpService.get(url, { headers, params })
            );

            const data = response.data;

            // Check data structure return
            if (data && data.data && data.data.length > 0) {
                const latestData = data.data[0];
                console.log('last data', latestData);

                const rawPrice = latestData.MatchPrice
                    || latestData.ClosePrice
                    || latestData.ClosingPrice;

                const highestPrice = latestData.HighestPrice;

                const currentPrice = parseFloat(rawPrice);

                const rawChange = latestData.PerPriceChange || latestData.ChangePercent;
                const changePercent = parseFloat(rawChange);

                if (currentPrice && !isNaN(currentPrice)) {

                    const activeSignals = await this.signalRepository.find({
                        where: {
                            symbol: symbol,
                            status: In([SignalStatus.ACTIVE, SignalStatus.PENDING])
                        }
                    });

                    for (const signal of activeSignals) {

                        const updateData: any = {
                            current_price: currentPrice,
                            highest_price: highestPrice,
                            updated_at: new Date()
                        };

                        if (!isNaN(changePercent)) {
                            updateData.current_change_percent = changePercent;
                        }

                        if (signal.status === SignalStatus.PENDING) {
                            updateData.status = SignalStatus.ACTIVE;
                        }

                        // T+2.5 Logic
                        const T_PLUS_2_5_MS = 2.5 * 24 * 60 * 60 * 1000;
                        const timeSinceCreation = new Date().getTime() - new Date(signal.created_at).getTime();

                        if (timeSinceCreation < T_PLUS_2_5_MS) {
                            await this.signalRepository.update(signal.id, {
                                current_price: currentPrice,
                                current_change_percent: !isNaN(changePercent) ? changePercent : signal.current_change_percent,
                                updated_at: new Date()
                            });
                            continue;
                        }

                        // tính toán pnl để bắn tele có thể sửa lại theo công thức
                        const entryPrice = Number(signal.entry_price_min);
                        let pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
                        const pnlFormatted = parseFloat(pnlPercent.toFixed(2));

                        if (currentPrice >= Number(signal.tp1_price) && !signal.tp1_hit_at) {
                            updateData.tp1_hit_at = new Date();
                            this.logger.log(`🚀 ${symbol} HIT TP1 at ${currentPrice}`);

                            // call noti
                            await this.notiService.createSignalNotification({
                                symbol: symbol,
                                exchange: signal.exchange,
                                type: NotificationType.SIGNAL_TP_1,
                                price: currentPrice,
                                change_percent: changePercent,
                                signal_id: signal.id
                            });

                            // Send message to telegram
                            await this.telegramService.sendMessageToTelegram({
                                symbol,
                                type: 'TP1',
                                pnl_percent: pnlFormatted,
                            });
                        }

                        if (currentPrice >= Number(signal.tp2_price) && !signal.tp2_hit_at) {
                            updateData.tp2_hit_at = new Date();
                            this.logger.log(`🚀 ${symbol} HIT TP2 at ${currentPrice}`);

                            // call noti
                            await this.notiService.createSignalNotification({
                                symbol: symbol,
                                exchange: signal.exchange,
                                type: NotificationType.SIGNAL_TP_2,
                                price: currentPrice,
                                change_percent: changePercent,
                                signal_id: signal.id
                            });

                            // Send message to telegram
                            await this.telegramService.sendMessageToTelegram({
                                symbol,
                                type: 'TP2',
                                pnl_percent: pnlFormatted,
                            });
                        }

                        // TP3 -> Close immediately
                        if (currentPrice >= Number(signal.tp3_price) && !signal.tp3_hit_at) {
                            updateData.tp3_hit_at = new Date();
                            updateData.status = SignalStatus.CLOSED;
                            updateData.closed_at = new Date();
                            this.logger.log(`🚀 ${symbol} HIT TP3 at ${currentPrice} -> CLOSED`);

                            // call noti
                            await this.notiService.createSignalNotification({
                                symbol: symbol,
                                exchange: signal.exchange,
                                type: NotificationType.SIGNAL_TP_3,
                                price: currentPrice,
                                change_percent: changePercent,
                                signal_id: signal.id
                            });

                            // Send message to telegram
                            await this.telegramService.sendMessageToTelegram({
                                symbol,
                                type: 'TP3',
                                pnl_percent: pnlFormatted,
                            });
                        }

                        if (currentPrice <= Number(signal.stop_loss_price) && !signal.sl_hit_at) {
                            updateData.sl_hit_at = new Date();
                            this.logger.log(`🔻 ${symbol} HIT SL at ${currentPrice}`);

                            // call noti
                            await this.notiService.createSignalNotification({
                                symbol: symbol,
                                exchange: signal.exchange,
                                type: NotificationType.SIGNAL_SL,
                                price: currentPrice,
                                change_percent: changePercent,
                                signal_id: signal.id
                            });

                            // Send message to telegram
                            await this.telegramService.sendMessageToTelegram({
                                symbol,
                                type: 'SL',
                                pnl_percent: pnlFormatted,
                            });
                        }

                        const updateResult = await this.signalRepository.update({
                            id: signal.id,
                            symbol: symbol,
                            status: In([SignalStatus.ACTIVE, SignalStatus.PENDING])
                        }, updateData);

                        if (updateResult.affected !== undefined && updateResult.affected > 0) {
                            this.logger.log(`✅ SUCCESS: Updated ${symbol} to price ${currentPrice} & highest price ${highestPrice}`);
                        } else {
                            this.logger.warn(`⚠️ SKIPPED: ${symbol} fetched ${currentPrice} but no ACTIVE/PENDING signal found to update.`);
                        }

                    }

                    return true;
                } else {
                    this.logger.warn(`❌ [${symbol}] Price is invalid or missing keys. Data keys: ${Object.keys(latestData).join(', ')}`);
                    return false;
                }
            } else {
                this.logger.warn(`⚠️ [${symbol}] No data found for date ${dateStr}`);
                return false;
            }
        } catch (error) {
            this.logger.error(`Failed to update price for ${symbol}`, error.message);
            return false;
        }
    }

    //test
    async testManualTrigger(symbol: string, mockPrice: number) {
        this.logger.log(`🧪 TEST TRIGGER: ${symbol} với giá giả lập ${mockPrice}`);
        const now = new Date();

        // 1. Tìm các signal Active/Pending của mã này
        const activeSignals = await this.signalRepository.find({
            where: {
                symbol: symbol,
                status: In([SignalStatus.ACTIVE, SignalStatus.PENDING])
            }
        });

        if (activeSignals.length === 0) return { message: 'Không có signal nào đang chạy cho mã này' };

        // 2. Chạy vòng lặp check giá (Copy logic từ fetchAndUpdateOne)
        for (const signal of activeSignals) {
            const updateData: any = {
                current_price: mockPrice,
                updated_at: now
            };

            // Check TP1
            if (mockPrice >= Number(signal.tp1_price) && !signal.tp1_hit_at) {
                updateData.tp1_hit_at = now;
                // GỌI NOTI
                await this.notiService.createSignalNotification({
                    symbol: symbol,
                    exchange: signal.exchange,
                    type: NotificationType.SIGNAL_TP_1,
                    price: mockPrice,
                    change_percent: 5.0, // Fake %
                    signal_id: signal.id
                });
            }

            // Check SL
            if (mockPrice <= Number(signal.stop_loss_price) && !signal.sl_hit_at) {
                updateData.sl_hit_at = now;
                // GỌI NOTI
                await this.notiService.createSignalNotification({
                    symbol: symbol,
                    exchange: signal.exchange,
                    type: NotificationType.SIGNAL_SL,
                    price: mockPrice,
                    change_percent: -2.0, // Fake %
                    signal_id: signal.id
                });
            }

            // Save tạm để update hit_at (để không bị bắn noti 2 lần)
            await this.signalRepository.update(signal.id, updateData);
        }

        return { success: true, count: activeSignals.length };
    }

}
