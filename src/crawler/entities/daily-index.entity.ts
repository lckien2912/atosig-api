import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

@Entity("daily_index")
export class DailyIndex {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 50 })
    code: string; // e.g., VNINDEX, HNXIndex

    @Column({ type: "jsonb" })
    data: any;

    @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    created_at: Date;
}
