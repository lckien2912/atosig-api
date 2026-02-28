import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, BeforeInsert, ManyToOne, JoinColumn, Index } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { WithdrawalStatus } from '../enums/withdrawal-status.enum';
import { AffiliateWithdrawalRequest } from './affiliate-withdrawal-request.entity';

@Entity('affiliate_withdrawals')
export class AffiliateWithdrawal {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar' })
    affiliate_uid: string;

    @Column({ type: 'decimal', precision: 15, scale: 2 })
    amount: number;

    @Column({ type: 'enum', enum: WithdrawalStatus, default: WithdrawalStatus.AVAILABLE })
    status: WithdrawalStatus;

    @Column({ type: 'varchar', nullable: true })
    source_order_id: string | null;

    @Column({ type: 'smallint', nullable: true })
    level: number | null;

    @Index('IDX_withdrawal_request_id')
    @Column({ type: 'uuid', nullable: true })
    withdrawal_request_id: string | null;

    @ManyToOne(() => AffiliateWithdrawalRequest, r => r.commissions)
    @JoinColumn({ name: 'withdrawal_request_id' })
    withdrawal_request: AffiliateWithdrawalRequest;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @BeforeInsert()
    generateId() {
        if (!this.id) this.id = uuidv4();
    }
}
