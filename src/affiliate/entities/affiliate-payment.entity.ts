import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, BeforeInsert, OneToMany } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PaymentMethod } from '../enums/payment-method.enum';
import { AffiliateWithdrawalRequest } from './affiliate-withdrawal-request.entity';

@Entity('affiliate_payments')
export class AffiliatePayment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    batch_name: string | null;

    @Column({ type: 'decimal', precision: 15, scale: 2 })
    total_amount: number;

    @Column({ type: 'timestamp' })
    payment_date: Date;

    @Column({ type: 'varchar', length: 20 })
    payment_method: PaymentMethod;

    @Column({ type: 'varchar', length: 255, nullable: true })
    transaction_id: string | null;

    @Column({ type: 'varchar', length: 500, nullable: true })
    proof_url: string | null;

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @Column({ type: 'varchar', length: 36, nullable: true })
    created_by: string | null;

    @CreateDateColumn()
    created_at: Date;

    @OneToMany(() => AffiliateWithdrawalRequest, r => r.payment_id)
    withdrawal_requests: AffiliateWithdrawalRequest[];

    @BeforeInsert()
    generateId() {
        if (!this.id) this.id = uuidv4();
    }
}
