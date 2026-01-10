import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { KycStatus, UserRole, UserSubscriptionTier } from "../enums/user-status.enum";

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: "varchar", nullable: false })
    full_name: string;

    @Column({ type: "varchar", nullable: false, unique: true })
    email: string;

    @Column({ type: "varchar", nullable: false, select: false })
    password: string;

    @Column({ nullable: true })
    avatar_url: string;

    @Column({ type: "varchar", nullable: true })
    phone_number: string;

    @Column({ type: 'enum', enum: KycStatus, default: KycStatus.UNVERIFIED })
    kyc_status: KycStatus;

    @Column({ type: 'varchar', nullable: true })
    citizen_id: string;

    @Column({ type: 'enum', enum: UserSubscriptionTier, default: UserSubscriptionTier.FREE })
    subscription_tier: UserSubscriptionTier;

    @Column({ type: 'timestamp', nullable: true })
    subscription_end_date: Date; // Ngày hết hạn gói

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @Column({ type: 'boolean', default: false })
    is_verified: boolean;

    @Column({ type: 'varchar', default: 'ACTIVE' })
    status: string;

    @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
    role: UserRole;

    // @OneToMany(() => UserFavorite, (fav) => fav.user)
    // favorites: UserFavorite[];

    @Column({ type: "timestamp", default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @Column({ type: "timestamp", default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}