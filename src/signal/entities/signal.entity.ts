import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";
import { SignalStatus } from "../enums/signal-status.enum";

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
        scale: 2,
        default: 0,
        nullable: true,
    })
    sl_price: number;

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
    current_price: number; // Giá cập nhật realtime

    @Column({ default: true })
    is_premium: boolean;

    @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    created_at: Date;

    @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    updated_at: Date;
}
