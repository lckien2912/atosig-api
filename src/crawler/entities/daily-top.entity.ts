import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

@Entity("daily_top")
export class DailyTop {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 50 })
    group: string; // e.g., VNINDEX, VN30

    @Column({ type: "varchar", length: 50 })
    type: string; // e.g., Foreign, Proprietary

    @Column({ type: "jsonb" })
    data: any;

    @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    created_at: Date;
}
