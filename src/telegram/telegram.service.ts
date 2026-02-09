import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import moment from "moment";
import TelegramBot from "node-telegram-bot-api";
import QuickChart from "quickchart-js";

@Injectable()
export class TelegramService {
    private readonly logger = new Logger(TelegramService.name);
    private bot: TelegramBot;
    private readonly chatId: string;

    constructor(
        private readonly configService: ConfigService
    ) {
        const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
        this.chatId = this.configService.get<string>('TELEGRAM_CHAT_ID') || '';

        if (token) {
            this.bot = new TelegramBot(token, { polling: false });
        } else {
            this.logger.error('TELEGRAM_BOT_TOKEN not found!');
        }
    }

    /**
     * Send message to Telegram Hit TP/SL
     */
    async sendMessageToTelegram(data: {
        symbol: string;
        type: 'TP1' | 'TP2' | 'TP3' | 'SL';
        pnl_percent: number;
    }) {
        if (!this.bot || !this.chatId) return;
        try {
            const icon = data.pnl_percent > 0 ? '✅✅✅' : '🛑🛑🛑';
            const sign = data.pnl_percent > 0 ? '+' : '';

            const message = `${data.symbol} Done ${data.type} (${sign}${data.pnl_percent.toFixed(2)}%)${icon}`;

            await this.bot.sendMessage(this.chatId, message);

        } catch (error) {
            this.logger.error(`Lỗi gửi Telegram Hit Signal: ${error.message}`);
        }
    }

    async sendNewSignal(signal: any) {
        if (!this.bot || !this.chatId) return;

        try {

            const entry = Number(signal.entry_price_min);
            const entryMax = Number(signal.entry_price_max);
            const entryMin = Number(signal.entry_price_min);
            const entryAvg = (entryMin + entryMax) / 2;
            const tp1Price = Number(signal.tp1_price);
            const isLong = tp1Price > entry;
            const tp1 = Number(signal.tp1_price);
            const tp2 = Number(signal.tp2_price);
            const tp3 = Number(signal.tp3_price);
            const sl = Number(signal.stop_loss_price);

            const fmt = (n: number) => Number(n / 1000).toLocaleString('en-US', {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2,
            });

            // const chart = new QuickChart();
            // chart.setWidth(500);
            // chart.setHeight(300);
            // chart.setBackgroundColor('white');

            // chart.setConfig({
            //     type: 'bar',
            //     data: {
            //         labels: ['SL', 'Entry', 'TP1', 'TP2', 'TP3'],
            //         datasets: [{
            //             label: `Signal Levels: ${signal.symbol}`,
            //             data: [sl, entry, tp1, tp2, tp3],
            //             backgroundColor: [
            //                 'rgba(255, 99, 132, 0.7)',
            //                 'rgba(54, 162, 235, 0.7)',
            //                 'rgba(75, 192, 192, 0.7)',
            //                 'rgba(75, 192, 192, 0.7)',
            //                 'rgba(75, 192, 192, 0.7)',
            //             ],
            //             borderColor: [
            //                 'rgb(255, 99, 132)',
            //                 'rgb(54, 162, 235)',
            //                 'rgb(75, 192, 192)',
            //                 'rgb(75, 192, 192)',
            //                 'rgb(75, 192, 192)',
            //             ],
            //             borderWidth: 1
            //         }]
            //     },
            //     options: {
            //         plugins: {
            //             datalabels: {
            //                 anchor: 'end',
            //                 align: 'top',
            //                 formatter: (val) => {
            //                     return new Intl.NumberFormat('en-US').format(val);
            //                 },
            //                 font: { weight: 'bold' }
            //             }
            //         }
            //     }
            // });
            // const chartBuffer = await chart.toBinary();

            const calcPct = (target: number) => {
                if (!target) return '0.00%';
                // Long: (Target - Entry) / Entry
                // Short: (Entry - Target) / Entry
                const diff = isLong ? (target - entryAvg) : (entryAvg - target);
                const pct = (diff / entryAvg) * 100;
                const sign = pct > 0 ? '+' : '';
                return `${sign}${pct.toFixed(2)}%`;
            };

            const line = [
                `<b>Signal date:</b> ${moment(signal.signal_date).format('YYYY-MM-DD')}`,
                `<b>Time:</b> ${moment(signal.created_at).format('HH:mm')}`,
                `<b>${signal.symbol}</b> (${signal.exchange})`,
                `<b>Entry:</b> ${(!entryMax || entryMin === entryMax) ? fmt(entryMin) : `${fmt(entryMin)} - ${fmt(entryMax)}`}`,
                `<b>SL:</b> ${fmt(sl)} (${calcPct(sl)})`,
                `<b>TP1:</b> ${fmt(tp1)} (${calcPct(tp1)})`,
                `<b>TP2:</b> ${fmt(tp2)} (${calcPct(tp2)})`,
                `<b>TP3:</b> ${fmt(tp3)} (${calcPct(tp3)})`,
            ];

            const message = line.join('\n');

            this.bot.sendMessage(this.chatId, message, { parse_mode: 'HTML' });
            // await this.bot.sendPhoto(this.chatId, chartBuffer, {
            //     caption: message,
            //     parse_mode: 'HTML'
            // })

            await new Promise(r => setTimeout(r, 100));

            this.logger.log(`Sent chart signal for ${signal.symbol}`);

        } catch (error) {
            this.logger.error(`Lỗi gửi Telegram New Signal: ${error.message}`);
        }

    }

    /**
     * Send daily summary of Profit/Loss
     */
    async sendDailySummary(message: string) {
        if (!this.bot || !this.chatId) return;
        try {
            await this.bot.sendMessage(this.chatId, message);
        } catch (error) {
            this.logger.error(`Lỗi gửi Telegram Daily Summary: ${error.message}`);
        }
    }
}