import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

@Entity("daily_stock")
export class DailyStock {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 10 })
    symbol: string;

    @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
    price: number;

    @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
    change_v: number; // Value change

    @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
    change_p: number; // Percent change

    @Column({ type: "varchar", length: 50, nullable: true })
    trading_date: string; // e.g., 09/01/2026

    @Column({ type: "jsonb", nullable: true })
    raw_data: any; // Store full response for flexibility

    @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    created_at: Date;
}
