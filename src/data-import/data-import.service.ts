import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Signal } from "../signal/entities/signal.entity";
import { SignalStatus } from "../signal/enums/signal-status.enum";
import csv from "csv-parser";
import { Readable } from "stream";
import moment from "moment";
import { Company } from "src/company/entities/company.entity";

interface CsvRow {
    ticker?: string;
    exchange?: string;
    signal_date?: string;
    p_base?: string;
    entry_date?: string;
    entry_price?: string;
    sl_price?: string;
    sl_pct?: string;
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
};

interface CompanyCsvRow {
    ticker?: string;
    Year?: string;
    Quarter?: string;
    'P/E'?: string;
    ROE?: string;
    'Vốn hoá'?: string;
    'Nợ/VCSH'?: string;
    'Ghi chú'?: string;
    'ROE (%)'?: string;
    exchange?: string;
    companyProfile?: string;
}

@Injectable()
export class DataImportService {
    constructor(
        @InjectRepository(Signal)
        private readonly signalRepository: Repository<Signal>,
        @InjectRepository(Company)
        private readonly companyRepository: Repository<Company>,
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

    async importCompanyCsv(buffer: Buffer): Promise<{ success: boolean; count: number; message: string }> {
        const csvContent = buffer.toString('utf8').replace(/^\uFEFF/, '');
        const stream = Readable.from(csvContent);
        const companies: Company[] = [];

        return new Promise((resolve, reject) => {
            stream
                .pipe(csv({
                    mapHeaders: ({ header }) => header.trim()
                }))
                .on('data', (data: unknown) => {
                    const row = data as CompanyCsvRow;
                    try {
                        if (!row.ticker) return;

                        const company = new Company();
                        company.symbol = row.ticker.trim();
                        // company.exchange = row.exchange?.trim();
                        company.year = this.parseNumberCompany(row.Year, true);
                        company.quarter = this.parseNumberCompany(row.Quarter, true);
                        company.pe = this.parseDecimal(row['P/E']);
                        company.roe = this.parseDecimal(row.ROE);
                        company.market_capitalization = this.parseDecimal(row['Vốn hoá']);
                        company.debt_to_equity_ratio = this.parseDecimal(row['Nợ/VCSH']);
                        company.roe_percent = this.parseDecimal(row['ROE (%)']);
                        company.note = row['Ghi chú'] || '';
                        company.exchange = row.exchange || '';
                        const rawProfile = row.companyProfile || '';
                        company.company_profile = this.stripHtml(rawProfile);

                        companies.push(company);
                    } catch (error) {
                        console.error(`Lỗi parse dòng ticker ${row.ticker}:`, error);
                    }
                })
                .on('end', async () => {
                    try {
                        if (companies.length > 0) {
                            await this.companyRepository.save(companies, { chunk: 100 });
                        }

                        resolve({
                            success: true,
                            count: companies.length,
                            message: `Import thành công ${companies.length} công ty.`
                        });
                    } catch (dbError) {
                        console.error("Lỗi lưu DB:", dbError);
                        reject(dbError);
                    }
                })
                .on("error", (error) => {
                    reject(error);
                });
        });
    }

    private createSignalFromRow(row: CsvRow): Signal {
        const signal = new Signal();
        signal.symbol = row.ticker?.trim() || "";
        signal.exchange = row.exchange?.trim() || "Unknown";
        signal.price_base = this.parseNumber(row.p_base);

        signal.signal_date = this.parseDate(row.signal_date);

        if (signal.signal_date) {
            signal.holding_period = moment(signal.signal_date).add(10, 'days').toDate();
        }

        signal.entry_date = this.parseDate(row.entry_date);
        signal.created_at = signal.signal_date || new Date();

        signal.entry_price_min = this.parseNumber(row.entry_price) || 0;
        signal.entry_price_max = this.parseNumber(row.entry_price);

        signal.stop_loss_price = this.parseNumber(row.sl_price) || 0;
        signal.stop_loss_pct = this.parseNumber(row.sl_pct) || 0;

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

        signal.status = SignalStatus.ACTIVE;
        signal.is_premium = true;
        signal.is_notified = false;

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

    private stripHtml(html: string): string {
        if (!html) return '';
        return html.replace(/<[^>]*>?/gm, '').trim();
    }

    private parseNumberCompany(value: string | undefined, isInt: boolean = false): number {
        if (!value) return 0;
        const cleanValue = value.toString().replace(/,/g, '');
        const num = isInt ? parseInt(cleanValue, 10) : parseFloat(cleanValue);
        return isNaN(num) ? 0 : num;
    }

    private parseDecimal(value: string | undefined): string | null {
        if (!value) return null;

        const clean = value.toString().trim().replace(/,/g, '');

        if (clean === '') return null;

        if (isNaN(Number(clean))) return null;

        return clean;
    }
}
