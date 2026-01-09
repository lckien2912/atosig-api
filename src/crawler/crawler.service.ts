import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { HttpService } from "@nestjs/axios";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { lastValueFrom } from "rxjs";
import { Signal } from "../signal/entities/signal.entity";
import { SignalStatus } from "../signal/enums/signal-status.enum";
import moment from "moment";

@Injectable()
export class CrawlerService {
    private readonly logger = new Logger(CrawlerService.name);

    // cờ tránh trạng thái job chồng chéo
    private isJobRunning = false;

    // Cấu hình từ ssi
    private readonly ssiConfig = {
        authUrl: 'https://fc-data.ssi.com.vn/api/v2/Market/AccessToken',
        priceUrl: 'https://fc-data.ssi.com.vn/api/v2/Market/DailyStockPrice',
        consumerID: '9386329312674e1c8e359084531eccb0',
        consumerSecret: '5ea3e893cbae4ec7ac461df63c68bb58'
    }

    private accessToken: string = '';
    private tokenExpiry: number = 0;

    constructor(
        @InjectRepository(Signal)
        private readonly signalRepository: Repository<Signal>,
        private readonly httpService: HttpService
    ) { }

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

            // Check cau truc tra ve
            if (data && data.data && data.data.length > 0) {
                const latestData = data.data[0];

                const rawPrice = latestData.MatchPrice
                    || latestData.ClosePrice
                    || latestData.ClosingPrice;

                const currentPrice = parseFloat(rawPrice);

                if (currentPrice && !isNaN(currentPrice)) {
                    const updateResult = await this.signalRepository
                        .createQueryBuilder()
                        .update(Signal)
                        .set({
                            current_price: currentPrice,
                            updated_at: new Date()
                        })
                        .where("symbol = :symbol", { symbol })
                        .andWhere("status IN (:...statuses)", {
                            statuses: [SignalStatus.ACTIVE, SignalStatus.PENDING]
                        })
                        .execute();

                    if (updateResult.affected !== undefined && updateResult.affected > 0) {
                        this.logger.log(`✅ SUCCESS: Updated ${symbol} to price ${currentPrice}`);
                    } else {
                        this.logger.warn(`⚠️ SKIPPED: ${symbol} fetched ${currentPrice} but no ACTIVE/PENDING signal found to update.`);
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

}
