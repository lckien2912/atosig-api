import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, BeforeInsert } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('notification_reads')
@Index(['user_id', 'notification_id'], { unique: true })
export class NotificationRead {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'uuid' })
    notification_id: string;

    @CreateDateColumn()
    read_at: Date;

    @BeforeInsert()
    generateId() {
        if (!this.id) {
            this.id = uuidv4();
        }
    }
}