import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, BeforeInsert } from 'typeorm';
import { DuarationDays, UserSubscriptionTier } from '../../users/enums/user-status.enum';
import { v4 as uuidv4 } from 'uuid';

@Entity('pricings')
export class SubscriptionPlan {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 100 })
    name: string; // VD: "Gói tháng", "Gói trải nghiệm"

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'decimal', precision: 12, scale: 0 })
    price: number; // Giá bán thực tế (VD: 1990000)

    @Column({ type: 'integer', nullable: true })
    discount_percentage: number;

    @Column({ type: 'enum', enum: DuarationDays, default: DuarationDays.WEEK })
    duration_days: DuarationDays; // Thời hạn (7 ngày, 30 ngày, 90 ngày)

    @Column({ type: 'enum', enum: UserSubscriptionTier, default: UserSubscriptionTier.PREMIUM })
    tier: UserSubscriptionTier; // Gói này thuộc quyền lợi nào (BASIC, PREMIUM...)

    @Column({ type: 'jsonb', nullable: true })
    features: string[]; // Mảng các tính năng nổi bật (để hiển thị gạch đầu dòng trên UI)

    @Column({ type: 'boolean', default: true })
    is_active: boolean; // Admin có thể ẩn gói này đi nếu không muốn bán nữa

    @Column({ type: 'boolean', default: false })
    is_featured: boolean; // Đánh dấu "Khuyên dùng" hoặc "Hot" (để UI làm nổi bật)

    @Column({ type: "timestamp", default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @Column({ type: "timestamp", default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;

    @BeforeInsert()
    generateId() {
        if (!this.id) {
            this.id = uuidv4();
        }
    }
}