import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Signal } from "../signal/entities/signal.entity";
import { SignalStatus } from "../signal/enums/signal-status.enum";
import csv from "csv-parser";
import { Readable } from "stream";

interface CsvRow {
    ticker?: string;
    exchange?: string;
    signal_date?: string;
    p_base?: string;
    entry_date?: string;
    entry_price?: string;
    sl_price?: string;
    tp1_price?: string;
    tp2_price?: string;
    tp3_price?: string;
    tp1_pct?: string;
    tp2_pct?: string;
    tp3_pct?: string;
    rr_tp1?: string;
    rr_tp2?: string;
    rr_tp3?: string;
    atr_pct?: string;
    recent_low?: string;
}

@Injectable()
export class DataImportService {
    constructor(
        @InjectRepository(Signal)
        private readonly signalRepository: Repository<Signal>,
    ) { }

    async importCsv(buffer: Buffer): Promise<boolean> {
        const stream = Readable.from(buffer.toString());
        const signals: Signal[] = [];

        return new Promise((resolve, reject) => {
            stream
                .pipe(csv())
                .on("data", (data: unknown) => {
                    const row = data as CsvRow;
                    try {
                        if (!row.ticker) {
                            console.warn('Skipping row: missing ticker', row);
                            return;
                        }

                        const signal = this.createSignalFromRow(row);
                        signals.push(signal);
                    } catch (error) {
                        console.error("Error parsing row:", row, error);
                    }
                })
                .on("end", () => {
                    (async () => {
                        try {
                            if (signals.length > 0) {
                                await this.signalRepository.save(signals);
                            } else {
                                console.warn('No signals to save.');
                            }
                            resolve(true);
                        } catch (error) {
                            console.error('Error saving signals:', error);
                            reject(error instanceof Error ? error : new Error(String(error)));
                        }
                    })().catch((error) =>
                        reject(error instanceof Error ? error : new Error(String(error))),
                    );
                })
                .on("error", (error) => {
                    reject(error instanceof Error ? error : new Error(String(error)));
                });
        });
    }

    private createSignalFromRow(row: CsvRow): Signal {
        const signal = new Signal();
        signal.symbol = row.ticker?.trim() || "";
        signal.exchange = row.exchange?.trim() || "Unknown";
        signal.price_base = this.parseNumber(row.p_base);

        signal.signal_date = this.parseDate(row.signal_date);
        signal.entry_date = this.parseDate(row.entry_date);
        signal.created_at = signal.signal_date || new Date();

        signal.entry_price_min = this.parseNumber(row.entry_price) || 0;
        signal.entry_price_max = this.parseNumber(row.entry_price);

        signal.stop_loss_price = this.parseNumber(row.sl_price) || 0;
        signal.sl_price = this.parseNumber(row.sl_price);

        signal.tp1_price = this.parseNumber(row.tp1_price) || 0;
        signal.tp2_price = this.parseNumber(row.tp2_price) || 0;
        signal.tp3_price = this.parseNumber(row.tp3_price) || 0;

        signal.tp1_pct = this.parseNumber(row.tp1_pct);
        signal.tp2_pct = this.parseNumber(row.tp2_pct);
        signal.tp3_pct = this.parseNumber(row.tp3_pct);

        signal.rr_tp1 = this.parseNumber(row.rr_tp1);
        signal.rr_tp2 = this.parseNumber(row.rr_tp2);
        signal.rr_tp3 = this.parseNumber(row.rr_tp3);

        signal.atr_pct = this.parseNumber(row.atr_pct);
        signal.recent_low = this.parseNumber(row.recent_low);

        signal.status = SignalStatus.PENDING;
        signal.is_premium = true;

        return signal;
    }

    private parseNumber(val: string | undefined): number {
        if (!val) return 0;
        const clean = val.replace(/,/g, "").trim();
        return parseFloat(clean) || 0;
    }

    private parseDate(val: string | undefined): Date {
        if (!val) return new Date();
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
        return new Date();
    }
}
