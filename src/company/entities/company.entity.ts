import { Entity, PrimaryGeneratedColumn, BeforeInsert, Column } from "typeorm";
import { v4 as uuidv4 } from 'uuid';

@Entity('companies')
export class Company {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 50 })
    symbol: string;

    @Column({ type: 'int' })
    year: number;

    @Column({ type: 'int' })
    quarter: number;

    @Column({ type: 'varchar', length: 255, nullable: true, default: null })
    company_name?: string | null;

    @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true, default: null })
    pe: string | null;

    @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true, default: null })
    roe: string | null;

    @Column({ type: 'decimal', precision: 30, scale: 2, nullable: true, default: null })
    market_capitalization: string | null;

    @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true, default: null })
    debt_to_equity_ratio: string | null;

    @Column({ type: 'text' })
    note: string | null;

    @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true, default: null })
    roe_percent: string | null;

    @Column({ type: 'varchar', length: 100 })
    exchange: string | null;

    @Column({ type: 'text' })
    company_profile: string | null;

    @Column({ type: "timestamp", default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @BeforeInsert()
    generateId() {
        if (!this.id) {
            this.id = uuidv4();
        }
    }
}