import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, BeforeInsert } from "typeorm";
import { SignalStatus } from "../enums/signal-status.enum";
import { v4 as uuidv4 } from 'uuid';

@Entity("signals")
export class Signal {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 10, nullable: false })
    symbol: string;

    @Column({ type: "varchar", length: 10 })
    exchange: string;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    price_base: number;

    @Column({ type: "date", nullable: true })
    signal_date: Date;

    @Column({ type: "date", nullable: true })
    entry_date: Date;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    entry_price_min: number; // Map từ entry_price

    @Column({
        type: "decimal",
        precision: 10,
        scale: 2,
        default: 0,
        nullable: true,
    })
    entry_price_max: number; // Map từ entry_price (hoặc logic vùng)

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    stop_loss_price: number;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    stop_loss_pct: number;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    tp1_price: number;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    tp2_price: number;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    tp3_price: number;

    @Column({
        type: "decimal",
        precision: 10,
        scale: 2,
        default: 0,
        nullable: true,
    })
    tp1_pct: number;

    @Column({
        type: "decimal",
        precision: 10,
        scale: 2,
        default: 0,
        nullable: true,
    })
    tp2_pct: number;

    @Column({
        type: "decimal",
        precision: 10,
        scale: 2,
        default: 0,
        nullable: true,
    })
    tp3_pct: number;

    @Column({
        type: "decimal",
        precision: 10,
        scale: 6,
        default: 0,
        nullable: true,
    })
    rr_tp1: number;

    @Column({
        type: "decimal",
        precision: 10,
        scale: 6,
        default: 0,
        nullable: true,
    })
    rr_tp2: number;

    @Column({
        type: "decimal",
        precision: 10,
        scale: 6,
        default: 0,
        nullable: true,
    })
    rr_tp3: number;

    @Column({ type: "decimal", precision: 10, scale: 6, default: 0, nullable: true })
    atr_pct: number;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0, nullable: true })
    recent_low: number;

    @Column({ type: "date", nullable: true })
    holding_period: Date;

    @Column({ type: "enum", enum: SignalStatus, default: SignalStatus.PENDING })
    status: SignalStatus;

    @Column({ type: "decimal", nullable: true })
    current_price: number; // Giá cập nhật realtime, cronjob tu ssi

    @Column({ type: "decimal", precision: 5, scale: 2, default: 0, nullable: true })
    current_change_percent: number; // % thay đổi so với giá cũ

    @Column({ default: true })
    is_premium: boolean;

    @CreateDateColumn()
    created_at: Date;

    @Column({ default: false })
    is_expired: boolean;

    @Column({ type: "timestamp", nullable: true })
    tp1_hit_at: Date;

    @Column({ type: "timestamp", nullable: true })
    tp2_hit_at: Date;

    @Column({ type: "timestamp", nullable: true })
    tp3_hit_at: Date;

    @Column({ type: "timestamp", nullable: true })
    sl_hit_at: Date;

    @Column({ type: "timestamp", nullable: true })
    closed_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @BeforeInsert()
    generateId() {
        if (!this.id) {
            this.id = uuidv4();
        }
    }
}
