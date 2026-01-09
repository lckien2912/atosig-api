import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { HttpService } from "@nestjs/axios";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { lastValueFrom } from "rxjs";
import { DailyTop } from "./entities/daily-top.entity";
import { DailyIndex } from "./entities/daily-index.entity";
import { DailyStock } from "./entities/daily-stock.entity";
import { Signal } from "../signal/entities/signal.entity";
import { SignalStatus } from "../signal/enums/signal-status.enum";

@Injectable()
export class CrawlerService {
    private readonly logger = new Logger(CrawlerService.name);
    private isRunning = false;

    // --- Config for SSI Fiin ---
    private readonly fiinRawToken = "47,122,114,137,224,81,48,97,62,39,0,213,93,58,165,244,197,93,209,36,221,105,229,84,236,161,62,188,11,19,118,113,166,216,210,102,45,0,61,153,137,65,230,142,107,152,184,30,217,108,187,149,89,7,132,37,237,168,118,91,245,117,198,145,221,255,60,181,236,14,88,239,88,141,97,220,205,7,27,5,130,1,121,113,185,242,203,195,150,100,27,212,160,16,63,207,50,240,83,163,9,191,119,169,144,115,13,185,173,53,60,59,150,103,237,77,245,46,159,103,60,233,68,191,78,97,240,10,183,228,177,34,231,95,235,127,141,148,110,25,100,186,8,197,54,25,207,84,213,30,185,221,194,106,19,49,226,242,21,108,169,105,71,60,171,152,82,246,175,194,207,218,18,134,233,4,117,43,158,7,213,207,56,19,90,17,252,65,205,49,180,116,218,204,202,194,232,184,202,222,33,160,86,8,96,156,135,59,113,28,57,72,199,217,121,239,3,143,210,24,41,111,176,44,227,29,66,130,26,52,148,152,35,56,119,7,163,133,88,191,130,138,69,19,203,82,197,231,242,234,237,98,240,84,214,45";
    private readonly fiinBaseUrl = "https://fiin-market.ssi.com.vn/MoneyFlow";

    // --- Config for SSI FC-Data ---
    private readonly ssiConfig = {
        consumerID: "9386329312674e1c8e359084531eccb0",
        consumerSecret: "5ea3e893cbae4ec7ac461df63c68bb58",
        url_auth: "https://fc-data.ssi.com.vn/api/v2/Market/AccessToken",
        url_stock: "https://fc-data.ssi.com.vn/api/v2/Market/DailyStockPrice"
    };
    private ssiAccessToken: string | null = null;
    private ssiTokenExpiry: number = 0; // Timestamp

    constructor(
        private readonly httpService: HttpService,
        @InjectRepository(DailyTop) private dailyTopRepository: Repository<DailyTop>,
        @InjectRepository(DailyIndex) private dailyIndexRepository: Repository<DailyIndex>,
        @InjectRepository(DailyStock) private dailyStockRepository: Repository<DailyStock>,
        @InjectRepository(Signal) private signalRepository: Repository<Signal>,
    ) { }

    private decodeFiinToken(encoded: string): string {
        try {
            // Strictly filter for valid HTTP header characters (RFC 7230)
            // Allowed: HTAB (9), SP (32), VCHAR (33-126), obs-text (128-255)
            // Forbidden: NUL (0), Control chars (1-31), DEL (127)
            return encoded.split(',')
                .map(Number)
                .filter(code => code === 9 || (code >= 32 && code !== 127))
                .map(code => String.fromCharCode(code))
                .join('');
        } catch (e) {
            this.logger.error("Failed to decode Fiin token", e);
            return "";
        }
    }

    private async getSSIAccessToken() {
        const now = Date.now();
        if (this.ssiAccessToken && now < this.ssiTokenExpiry) {
            return this.ssiAccessToken;
        }

        try {
            const response = await lastValueFrom(this.httpService.post(this.ssiConfig.url_auth, {
                consumerID: this.ssiConfig.consumerID,
                consumerSecret: this.ssiConfig.consumerSecret
            }));

            if (response.data && response.data.status === 200 && response.data.data?.accessToken) {
                this.ssiAccessToken = response.data.data.accessToken;
                this.ssiTokenExpiry = now + (30 * 60 * 1000); // Refresh every 30 mins (token essentially valid 1h)
                this.logger.log("SSI Access Token refreshed");
                return this.ssiAccessToken;
            }
            throw new Error("Invalid Auth Response");
        } catch (error) {
            this.logger.error("Failed to get SSI Access Token", error);
            return null;
        }
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async handleCron() {
        if (this.isRunning) {
            this.logger.warn("Job already running, skipping...");
            return;
        }
        this.isRunning = true;
        this.logger.log("Starting Market Data Sync...");

        try {
            // 1. Crawl SSI Fiin (Market Flows)
            const fiinToken = this.decodeFiinToken(this.fiinRawToken);
            const fiinHeaders = {
                "x-fiin-user-token": fiinToken,
                "origin": "https://iboard.ssi.com.vn",
                "User-Agent": "Mozilla/5.0",
            };

            const fiinPromises = [
                this.fetchAndSaveDailyTop(this.fiinBaseUrl, "/GetForeign", "VNINDEX", "Foreign", fiinHeaders),
                this.fetchAndSaveDailyTop(this.fiinBaseUrl, "/GetProprietaryV2", "VNINDEX", "Proprietary", fiinHeaders),
                this.fetchAndSaveDailyIndex(this.fiinBaseUrl, "/GetContribution", "VNINDEX", fiinHeaders),
                this.fetchAndSaveDailyIndex(this.fiinBaseUrl, "/GetContribution", "VN30", fiinHeaders, "VN30"),
                this.fetchAndSaveDailyIndex(this.fiinBaseUrl, "/GetContribution", "HNXIndex", fiinHeaders, "HNXIndex")
            ];

            // 2. Crawl SSI FC-Data (Stock Prices)
            const ssiPromises = [
                this.fetchAndSaveStockPrices()
            ];

            await Promise.all([...fiinPromises, ...ssiPromises]);

            this.logger.log("Market Data Sync Completed");
        } catch (error) {
            this.logger.error("Error during sync", error);
        } finally {
            this.isRunning = false;
        }
    }

    // --- SSI Fiin Logic ---

    private async fetchAndSaveDailyTop(baseUrl: string, endpoint: string, group: string, type: string, headers: any) {
        try {
            const url = `${baseUrl}${endpoint}?language=vi&ComGroupCode=${group}&time=${Date.now()}`;
            const response = await lastValueFrom(this.httpService.get(url, {
                headers,
                timeout: 15000 // 15s timeout
            }));

            console.log("DailyTop", response.data);
            return;

            if (response.data) {
                console.log(`[DailyTop ${group} ${type}] Success:`, JSON.stringify(response.data).substring(0, 200) + "...");
                const entity = new DailyTop();
                entity.group = group;
                entity.type = type;
                entity.data = response.data;
                await this.dailyTopRepository.save(entity);
                this.logger.log(`Saved DailyTop: ${group} - ${type}`);
            }
        } catch (error) {
            this.logger.error(`Failed to fetch DailyTop ${group} ${type} - ${error.message}`);
        }
    }

    private async fetchAndSaveDailyIndex(baseUrl: string, endpoint: string, comGroupCode: string, headers: any, codeOverride?: string) {
        try {
            const url = `${baseUrl}${endpoint}?language=vi&ComGroupCode=${comGroupCode}&time=${Date.now()}&Type=FreeFloat`;
            const response = await lastValueFrom(this.httpService.get(url, {
                headers,
                timeout: 15000
            }));

            if (response.data) {
                console.log(`[DailyIndex ${codeOverride || comGroupCode}] Success:`, JSON.stringify(response.data).substring(0, 200) + "...");
                const entity = new DailyIndex();
                entity.code = codeOverride || comGroupCode;
                entity.data = response.data;
                await this.dailyIndexRepository.save(entity);
                this.logger.log(`Saved DailyIndex: ${entity.code}`);

                // Fallback: Sync prices from Index if SSI FC-Data fails?
                // For now, let's rely on SSI FC-Data for prices as it's cleaner.
            }
        } catch (error) {
            this.logger.error(`Failed to fetch DailyIndex ${comGroupCode} - ${error.message}`);
        }
    }

    // --- SSI FC-Data Logic (Stock Prices) ---

    private async fetchAndSaveStockPrices() {
        const token = await this.getSSIAccessToken();
        if (!token) return;

        // Strategy: Get All Active Signals -> Fetch Prices for those symbols
        const activeSignals = await this.signalRepository.find({
            where: { status: SignalStatus.ACTIVE } // or logic for not CLOSED
        });

        if (!activeSignals.length) {
            this.logger.log("No ACTIVE signals to sync prices.");
            return;
        }

        // Get unique symbols
        const symbols = [...new Set(activeSignals.map(s => s.symbol))];

        // SSI DailyStockPrice usually fetches by page OR symbol. 
        // Based on provided config: "Symbol": "", "PageSize": 10.
        // We want SPECIFIC symbols. Let's try fetching by Symbol one by one or comma-separated if supported.
        // Usually FC-Data supports `Symbol` param.
        // To be safe and efficient, let's iterate. 
        // But for 1 minute interval, 10-20 symbols is fine. If 100+, we need bulk.
        // Assumption: Sending one request per symbol is simplest to start.

        const updates: Signal[] = [];
        const todayStr = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY

        const headers = { Authorization: `Bearer ${token}` };

        // For performance, we can group requests or try to find a bulk endpoint.
        // But let's follow the user's "DailyStockPrice" endpoint.
        // Optimization: Run in chunks of 5 parallel requests
        const chunk = 5;
        for (let i = 0; i < symbols.length; i += chunk) {
            const batch = symbols.slice(i, i + chunk);
            await Promise.all(batch.map(async (symbol) => {
                try {
                    const url = `${this.ssiConfig.url_stock}?Symbol=${symbol}&PageSize=1&PageIndex=1`;
                    const res = await lastValueFrom(this.httpService.get(url, { headers }));
                    const data = res.data?.data?.[0]; // Assuming data is array in 'data' field

                    if (data) {
                        console.log(`[StockPrice ${symbol}] Success: ${data.LastPrice || data.ClosePrice}`);
                        // Save to DailyStock
                        const ds = new DailyStock();
                        ds.symbol = symbol;
                        ds.price = data.LastPrice || data.ClosePrice; // Adjust based on actual API
                        ds.change_v = data.Change;
                        ds.change_p = data.PerChange;
                        ds.trading_date = data.TradingDate;
                        ds.raw_data = data;
                        await this.dailyStockRepository.save(ds);

                        // Update Signal
                        const signalsToUpdate = activeSignals.filter(s => s.symbol === symbol);
                        for (const s of signalsToUpdate) {
                            if (ds.price) {
                                s.current_price = Number(ds.price);
                                s.updated_at = new Date();
                                updates.push(s);
                            }
                        }
                    }
                } catch (err) {
                    this.logger.error(`Failed to fetch stock ${symbol} - ${err.message}`);
                }
            }));
        }

        if (updates.length > 0) {
            await this.signalRepository.save(updates);
            this.logger.log(`Synced prices for ${updates.length} signals via SSI FC-Data`);
        }
    }
}
