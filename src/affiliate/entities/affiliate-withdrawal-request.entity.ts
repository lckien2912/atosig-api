import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, BeforeInsert, OneToMany, Index } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { WithdrawalRequestStatus } from '../enums/withdrawal-request-status.enum';
import { AffiliateCommission } from './affiliate-commission.entity';
import { CommissionAuditLog } from './commission-audit-log.entity';

@Entity('affiliate_withdrawal_requests')
@Index('IDX_withdrawal_request_affiliate_status', ['affiliate_uid', 'status'])
export class AffiliateWithdrawalRequest {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar' })
    affiliate_uid: string;

    @Column({ type: 'decimal', precision: 15, scale: 2 })
    total_amount: number;

    @Column({ type: 'enum', enum: WithdrawalRequestStatus, default: WithdrawalRequestStatus.PENDING })
    status: WithdrawalRequestStatus;

    @Column({ type: 'varchar', nullable: true })
    user_note: string | null;

    @Column({ type: 'varchar', nullable: true })
    admin_note: string | null;

    @Column({ type: 'uuid', nullable: true })
    processed_by: string | null;

    @Column({ type: 'timestamp', nullable: true })
    processed_at: Date | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @Column({ type: 'uuid', nullable: true })
    payment_id: string | null;

    @Column({ type: 'timestamp', nullable: true })
    hold_until: Date | null;

    @OneToMany(() => AffiliateCommission, w => w.withdrawal_request)
    commissions: AffiliateCommission[];

    @OneToMany(() => CommissionAuditLog, log => log.withdrawal_request)
    audit_logs: CommissionAuditLog[];

    @BeforeInsert()
    generateId() {
        if (!this.id) this.id = uuidv4();
    }
}
