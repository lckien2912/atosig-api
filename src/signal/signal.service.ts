import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Signal } from "./entities/signal.entity";
import { SignalResponseDto } from "./dto/signal-response.dto";
import { SignalStatus } from "./enums/signal-status.enum";

@Injectable()
export class SignalService {
  constructor(
    @InjectRepository(Signal) private signalsRepository: Repository<Signal>,
  ) {}

  async getFeatured(): Promise<SignalResponseDto[]> {
    const signals = await this.signalsRepository.find({
      where: {
        is_premium: true,
        status: In([SignalStatus.PENDING, SignalStatus.ACTIVE]),
      },
      order: {
        created_at: "DESC", // Newest first
      },
    });

    return signals.map((signal) => this.mapToResponse(signal));
  }

  private mapToResponse(signal: Signal): SignalResponseDto {
    // Calculate efficiency (mock logic: (current - entry) / entry * 100)
    // If current_price is undefined, default to entry_price_min
    const currentPrice =
      signal.current_price !== undefined && signal.current_price !== null
        ? Number(signal.current_price)
        : Number(signal.entry_price_min);

    const entryMin = Number(signal.entry_price_min);
    const entryMax = Number(signal.entry_price_max || signal.entry_price_min);
    const entryAvg = (entryMin + entryMax) / 2;

    let efficiency = 0;
    if (entryAvg !== 0) {
      efficiency = ((currentPrice - entryAvg) / entryAvg) * 100;
    }

    // Expected profit (mock logic: max TP vs entry)
    const tp1 = Number(signal.tp1_price);
    const tp2 = Number(signal.tp2_price);
    const tp3 = Number(signal.tp3_price);
    const maxTp = Math.max(tp1, tp2, tp3);

    let expectedProfit = 0;
    if (entryAvg !== 0) {
      expectedProfit = ((maxTp - entryAvg) / entryAvg) * 100;
    }

    // Status Text Mapping based on Enum
    let statusText = "Chờ mua";
    if (signal.status === SignalStatus.ACTIVE) statusText = "Vùng mua"; // or "Nắm giữ" if price > entry
    if (signal.status === SignalStatus.CLOSED) statusText = "Đóng";

    // Action Text Mapping
    let actionText = "Theo dõi";
    if (signal.status === SignalStatus.ACTIVE) actionText = "Nắm giữ";

    return {
      symbol: signal.symbol,
      current_price: currentPrice,
      change_percent: 2.0, // Mock: Would need realtime market data API
      publish_date: signal.created_at
        ? new Date(signal.created_at).toLocaleDateString("en-GB")
        : "",
      status_text: statusText,
      expected_profit: Number(expectedProfit.toFixed(2)),
      efficiency: Number(efficiency.toFixed(2)),
      entry_zone: `${entryMin} - ${entryMax}`,
      tp1: tp1,
      tp2: tp2,
      tp3: tp3,
      holding_time: "2 tuần", // Mock
      action_text: actionText,
    };
  }

  getCurrent() {
    return this.signalsRepository.find({
      where: {
        status: In([SignalStatus.PENDING, SignalStatus.ACTIVE]),
      },
      order: {
        created_at: "DESC",
      },
    });
  }

  getHistory() {
    return this.signalsRepository.find({
      where: {
        status: SignalStatus.CLOSED,
      },
      order: {
        updated_at: "DESC",
      },
    });
  }

  async findOne(id: string) {
    const signal = await this.signalsRepository.findOne({
      where: { id },
    });
    if (!signal) return null;
    // Ideally should map this to a detail DTO too, but for now returning entity
    return signal;
  }
}
