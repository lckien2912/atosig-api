import { Injectable } from '@nestjs/common';
import { CreateSignalDto } from './dto/create-signal.dto';
import { UpdateSignalDto } from './dto/update-signal.dto';
import { Signal } from './entities/signal.entity';

@Injectable()
export class SignalService {
    private signals: Signal[] = [];

    constructor() {
        this.seedMockData();
    }

    private seedMockData() {
        this.signals.push({
            id: 1,
            symbol: 'ACB',
            tradingViewSymbol: 'HOSE:ACB',
            full_name: 'Ngân hàng TMCP Á Châu',
            description: 'ACB là một trong những ngân hàng thương mại cổ phần hàng đầu tại Việt Nam, với hệ thống mạng lưới chi nhánh và phòng giao dịch trải dài 49 tỉnh thành trong số 63 tỉnh thành trong cả nước và có hơn 13.000 nhân viên, với nhiều loại hình sản phẩm, dịch vụ đa dạng.',
            current_price: 40.10,
            entry_zone_min: 38.50,
            entry_zone_max: 39.40,
            expected_profit: 19.48,
            holding_time: '2 tuần',
            stop_loss: 37.58,
            take_profit_1: 39.50,
            take_profit_2: 40.50,
            take_profit_3: 42.00,
            status_message: 'Đã đạt TP1',
            remaining_to_next_tp: 2.36,
            progress: 65,
            financials: {
                intrinsic_value: 220.00,
                target_price: 220.00,
                market_cap: '$3.4T',
                pe_ratio: 34.2,
                roe: '148%',
                debt_to_equity: 0.4
            },
            created_at: new Date('2025-11-05T10:30:22'),
        });
    }

    create(createSignalDto: CreateSignalDto) {
        const newSignal = {
            id: this.signals.length + 1,
            // Default mock values for created signal to match type
            symbol: createSignalDto.name || 'NEW',
            tradingViewSymbol: `HOSE:${createSignalDto.name || 'NEW'}`,
            full_name: createSignalDto.description || 'New Signal',
            // description: 'Auto-generated description',
            current_price: 100,
            entry_zone_min: 90,
            entry_zone_max: 95,
            expected_profit: 10,
            holding_time: '1 tuần',
            stop_loss: 85,
            take_profit_1: 110,
            take_profit_2: 120,
            status_message: 'New',
            progress: 0,
            financials: {
                intrinsic_value: 0,
                target_price: 0,
                market_cap: '0',
                pe_ratio: 0,
                roe: '0%',
                debt_to_equity: 0
            },
            created_at: new Date(),
            ...createSignalDto,
        } as Signal;

        this.signals.push(newSignal);
        return newSignal;
    }

    findAll() {
        return this.signals;
    }

    findOne(id: number) {
        // For demo, always return the mocked ACB signal if ID=1, or find by ID
        return this.signals.find((signal) => signal.id === id);
    }

    update(id: number, updateSignalDto: UpdateSignalDto) {
        const index = this.signals.findIndex((signal) => signal.id === id);
        if (index !== -1) {
            this.signals[index] = {
                ...this.signals[index],
                ...updateSignalDto,
            };
            return this.signals[index];
        }
        return null;
    }

    remove(id: number) {
        const index = this.signals.findIndex((signal) => signal.id === id);
        if (index !== -1) {
            const deletedSignal = this.signals[index];
            this.signals.splice(index, 1);
            return deletedSignal;
        }
        return null;
    }
}
