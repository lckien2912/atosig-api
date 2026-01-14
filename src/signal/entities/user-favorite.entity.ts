import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, BeforeInsert } from "typeorm";
import { Signal } from "./signal.entity";
import { v4 as uuidv4 } from 'uuid';

@Entity('user_favorites')
export class UserFavorite {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: "uuid", nullable: false })
    user_id: string;

    @Column({ type: "uuid", nullable: false })
    signal_id: string;

    @ManyToOne(() => Signal)
    @JoinColumn({ name: 'signal_id' })
    signal: Signal;

    @CreateDateColumn()
    created_at: Date;

    @BeforeInsert()
    generateId() {
        if (!this.id) {
            this.id = uuidv4();
        }
    }
}