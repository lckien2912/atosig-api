import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { UserSubscriptionTier } from '../../users/enums/user-status.enum'; // Import Enum từ User Module

@Entity('subscription_plans')
export class SubscriptionPlan {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 100 })
    name: string; // VD: "Gói tháng", "Gói trải nghiệm"

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'decimal', precision: 12, scale: 0 })
    price: number; // Giá bán thực tế (VD: 1990000)

    @Column({ type: 'decimal', precision: 12, scale: 0, nullable: true })
    original_price: number; // Giá gốc (để gạch đi, hiển thị giảm giá)

    @Column({ type: 'int' })
    duration_days: number; // Thời hạn (7 ngày, 30 ngày, 90 ngày)

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
}