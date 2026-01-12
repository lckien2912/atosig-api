import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BeforeInsert } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PaymentGateway, PaymentStatus, PaymentCurrency } from '../enums/payment.enum';
import { UserSubscription } from 'src/pricing/entities/user-subscription.entity';
import { v4 as uuidv4 } from 'uuid';

@Entity('payment_transactions')
export class PaymentTransaction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    // ID của subscription (hoặc Order ID)
    @Column({ type: 'uuid' })
    subscription_id: string;

    @ManyToOne(() => UserSubscription, (sub) => sub.transactions)
    @JoinColumn({ name: 'subscription_id' })
    subscription: UserSubscription;

    @Column({ type: 'decimal', precision: 15, scale: 2 })
    amount: number;

    @Column({ type: 'enum', enum: PaymentCurrency, default: PaymentCurrency.VND })
    currency: PaymentCurrency;

    @Column({ type: 'enum', enum: PaymentGateway })
    gateway: PaymentGateway;

    @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
    status: PaymentStatus;

    // Mã giao dịch sinh ra bởi hệ thống mình (VD: TXN_20260111_001)
    @Column({ type: 'varchar', unique: true })
    transaction_code: string;

    // Mã giao dịch trả về từ cổng thanh toán (VD: 12345678 của VNPAY)
    @Column({ type: 'varchar', nullable: true })
    gateway_transaction_id: string;

    // Lưu toàn bộ response từ cổng thanh toán để debug khi cần
    @Column({ type: 'jsonb', nullable: true })
    gateway_response: any;

    @Column({ nullable: true })
    payment_url: string; // Link thanh toán đã tạo

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @BeforeInsert()
    generateId() {
        if (!this.id) {
            this.id = uuidv4();
        }
    }
}