import { BeforeInsert, Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { KycStatus, LoginType, UserRole, UserSubscriptionTier } from "../enums/user-status.enum";
import { v4 as uuidv4 } from 'uuid';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: "varchar", nullable: false })
    full_name: string;

    @Column({ type: "varchar", nullable: false, unique: true })
    email: string;

    @Column({ type: "varchar", select: false, nullable: true })
    password?: string;

    @Column({ type: "text", nullable: true })
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

    @Column({ type: 'boolean', default: false })
    is_locked: boolean;

    @Column({ type: 'varchar', default: 'ACTIVE' })
    status: string;

    @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
    role: UserRole;

    @Column({ type: 'varchar', nullable: true })
    google_id: string;

    @Column({ type: 'varchar', nullable: true })
    avatar: string;

    @Column({ type: 'enum', enum: LoginType, default: LoginType.EMAIL })
    login_type: LoginType;

    // @OneToMany(() => UserFavorite, (fav) => fav.user)
    // favorites: UserFavorite[];

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