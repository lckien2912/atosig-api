import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { lastValueFrom } from "rxjs";
import { Signal } from "../signal/entities/signal.entity";
import { SignalStatus } from "../signal/enums/signal-status.enum";
import moment from "moment";
import { NotificationsService } from "src/notification/notifications.service";
import { NotificationType } from "src/notification/enums/notification.enum";

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
     * update is_expired
     */
    @Cron(CronExpression.EVERY_HOUR)
    async handleCronUpdateIsExpired() {
        this.logger.log('--- Checking for expired signals ---');

        try {
            const now = new Date();

            const result = await this.signalRepository
                .createQueryBuilder()
                .update(Signal)
                .set({ is_expired: true })
                .where("is_expired = :isExpired", { isExpired: false })
                .andWhere("holding_period < :now", { now })
                .andWhere("status != :status", { status: SignalStatus.CLOSED })
                .execute();

            if (result.affected && result.affected > 0) {
                this.logger.log(`✅ Auto-expired ${result.affected} signals.`);
            } else {
                this.logger.log('No signals expired this hour.');
            }
        } catch (error) {
            this.logger.error('Error auto-expiring signals', error);
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

                const rawPrice = latestData.MatchPrice
                    || latestData.ClosePrice
                    || latestData.ClosingPrice;

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
                            updated_at: new Date()
                        };

                        if (!isNaN(changePercent)) {
                            updateData.current_change_percent = changePercent;
                        }

                        if (signal.status === SignalStatus.PENDING) {
                            updateData.status = SignalStatus.ACTIVE;
                        }

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
                            })
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
                            })
                        }

                        if (currentPrice >= Number(signal.tp3_price) && !signal.tp3_hit_at) {
                            updateData.tp3_hit_at = new Date();
                            this.logger.log(`🚀 ${symbol} HIT TP3 at ${currentPrice}`);

                            // call noti
                            await this.notiService.createSignalNotification({
                                symbol: symbol,
                                exchange: signal.exchange,
                                type: NotificationType.SIGNAL_TP_3,
                                price: currentPrice,
                                change_percent: changePercent,
                                signal_id: signal.id
                            })
                        }

                        if (currentPrice <= Number(signal.stop_loss_price) && !signal.sl_hit_at) {
                            updateData.sl_hit_at = new Date();
                            updateData.status = SignalStatus.CLOSED;
                            this.logger.log(`🔻 ${symbol} HIT SL at ${currentPrice}`);

                            // call noti
                            await this.notiService.createSignalNotification({
                                symbol: symbol,
                                exchange: signal.exchange,
                                type: NotificationType.SIGNAL_SL,
                                price: currentPrice,
                                change_percent: changePercent,
                                signal_id: signal.id
                            })
                        }

                        const updateResult = await this.signalRepository.update({
                            id: signal.id,
                            symbol: symbol,
                            status: In([SignalStatus.ACTIVE, SignalStatus.PENDING])
                        }, updateData);

                        if (updateResult.affected !== undefined && updateResult.affected > 0) {
                            this.logger.log(`✅ SUCCESS: Updated ${symbol} to price ${currentPrice}`);
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
