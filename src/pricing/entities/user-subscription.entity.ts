import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { SubscriptionPlan } from './subscription-plan.entity';
import { SubscriptionStatus } from '../enums/pricing.enum';


@Entity('user_subscriptions')
export class UserSubscription {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    // Quan hệ với User
    @Column({ type: 'varchar' })
    user_id: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    // Quan hệ với Plan (Snapshot thông tin gói tại thời điểm mua)
    @Column({ type: 'varchar', nullable: true })
    plan_id: string;

    @ManyToOne(() => SubscriptionPlan)
    @JoinColumn({ name: 'plan_id' })
    plan: SubscriptionPlan;

    @Column({ type: 'decimal', precision: 12, scale: 0 })
    amount_paid: number; // Số tiền thực tế user đã trả

    @Column({ type: 'timestamp' })
    start_date: Date;

    @Column({ type: 'timestamp' })
    end_date: Date;

    @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.PENDING })
    status: SubscriptionStatus;

    @Column({ type: 'varchar', nullable: true })
    payment_method: string; // 'BANK_TRANSFER', 'VNPAY', 'MOMO'...

    @Column({ type: 'varchar', nullable: true })
    transaction_code: string; // Mã giao dịch từ cổng thanh toán

    @CreateDateColumn()
    created_at: Date;
}