import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('user_favorites')
export class UserFavorite {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: "varchar", nullable: false })
    user_id: string;

    @Column({ type: "varchar", nullable: false })
    signal_id: string;

    @CreateDateColumn()
    created_at: Date;
}