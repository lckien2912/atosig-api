import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import moment from "moment";
import { lastValueFrom } from "rxjs";

@Injectable()
export class MarketService {
    private readonly logger = new Logger(MarketService.name);

    private accessToken: string = '';
    private tokenExpiry: number = 0;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService
    ) { }

    private async getSSIToken() {
        const now = Date.now();

        if (this.accessToken && now < this.tokenExpiry - 60000) {
            return this.accessToken;
        }

        try {
            const consumerID = this.configService.get<string>('SSI_CONSUMER_ID');
            const consumerSecret = this.configService.get<string>('SSI_CONSUMER_SECRET');

            const res = await lastValueFrom(this.httpService.post(
                'https://fc-data.ssi.com.vn/api/v2/Market/AccessToken',
                {
                    consumerID,
                    consumerSecret
                }
            ));

            if (res.data && res.data.data) {
                this.accessToken = res.data.data.accessToken;
                this.tokenExpiry = now + (res.data.data.expiresIn * 1000);
                this.logger.log('Đã refresh SSI Token thành công');
                return this.accessToken;
            }
        } catch (error) {
            this.logger.error('Lỗi lấy Token SSI', error.response?.data || error.message);
            return null;
        }
    }

    async getHistory(symbol: string) {
        const token = await this.getSSIToken();
        if (!token) return [];

        const requests: Promise<any>[] = [];

        const chunkDays = 29;
        const totalChunks = 6;

        for (let i = 0; i < totalChunks; i++) {
            const toDate = moment().subtract(i * chunkDays, 'days');
            const fromDate = moment().subtract((i + 1) * chunkDays, 'days').add(1, 'days');

            const toDateStr = toDate.format('DD/MM/YYYY');
            const fromDateStr = fromDate.format('DD/MM/YYYY');

            const request = lastValueFrom(this.httpService.get(
                'https://fc-data.ssi.com.vn/api/v2/Market/DailyStockPrice',
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: {
                        Symbol: symbol,
                        FromDate: fromDateStr,
                        ToDate: toDateStr,
                        PageIndex: 1,
                        PageSize: 1000,
                        Ascending: true
                    }
                }
            ))
                .then(res => {
                    if (!res.data || !res.data.data) {
                        console.warn(`[WARN] Chunk ${i} thành công nhưng không có dữ liệu:`, res.data);
                        return [];
                    }
                    return res.data.data;
                })
                .catch(err => {
                    if (err.response) {
                        console.error('   Status:', err.response.status);
                        console.error('   Data:', JSON.stringify(err.response.data));
                    } else {
                        console.error('   Message:', err.message);
                    }
                    return [];
                });

            requests.push(request);
        }

        try {
            const results = await Promise.all(requests);
            const flatData = results.flat();

            if (flatData.length === 0) return [];

            const formattedData = flatData
                .filter((item: any) => item && (item.Date || item.date || item.TradingDate))
                .map((item: any) => {
                    const rawDate = item.TradingDate || item.Date || item.date;
                    const time = rawDate.includes('/')
                        ? rawDate.split('/').reverse().join('-')
                        : rawDate.split('T')[0];

                    const open = Number(item.OpenPrice || item.Open || item.open) / 1000;
                    const high = Number(item.HighestPrice || item.High || item.high) / 1000;
                    const low = Number(item.LowestPrice || item.Low || item.low) / 1000;
                    const close = Number(item.ClosePrice || item.Close || item.close) / 1000;

                    return { time, open, high, low, close };
                });

            const uniqueData = formattedData.filter((v, i, a) => a.findIndex(t => (t.time === v.time)) === i);

            return uniqueData.sort((a: any, b: any) =>
                new Date(a.time).getTime() - new Date(b.time).getTime()
            );

        } catch (error) {
            this.logger.error(`Lỗi tổng hợp lịch sử ${symbol}:`, error.message);
            return [];
        }
    }

    // real-time (demo)
    async getLastestPrice(symbol: string) {
        const token = await this.getSSIToken();
        if (!token) return [];

        try {
            const { data } = await lastValueFrom(this.httpService.get(
                'https://fc-data.ssi.com.vn/api/v2/Market/Securities',
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { Lookup: symbol, Indent: true }
                }
            ));

            if (data && data.data && data.data.length > 0) {
                const stock = data.data[0];
                return {
                    symbol: stock.Symbol,
                    price: stock.LastPrice / 1000,
                    change: stock.Change,
                    totalVol: stock.TotalVol,
                    time: Date.now()
                };
            }
            return null;
        } catch (error) {
            this.logger.warn(`Lỗi lấy giá Live ${symbol}: ${error.message}`);
            return null;
        }
    }
}