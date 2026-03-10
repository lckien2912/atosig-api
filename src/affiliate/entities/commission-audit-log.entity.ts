import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, BeforeInsert, ManyToOne, JoinColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AffiliateWithdrawalRequest } from './affiliate-withdrawal-request.entity';

@Entity('commission_audit_logs')
export class CommissionAuditLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', nullable: true })
    request_id: string | null;

    @Column({ type: 'varchar', nullable: true })
    affiliate_uid: string | null;

    @Column({ type: 'varchar', length: 20 })
    action: string;

    @Column({ type: 'varchar', length: 36, nullable: true })
    performed_by: string | null;

    @Column({ type: 'text', nullable: true })
    note: string | null;

    @CreateDateColumn()
    created_at: Date;

    @ManyToOne(() => AffiliateWithdrawalRequest, r => r.audit_logs)
    @JoinColumn({ name: 'request_id' })
    withdrawal_request: AffiliateWithdrawalRequest;

    @BeforeInsert()
    generateId() {
        if (!this.id) this.id = uuidv4();
    }
}
