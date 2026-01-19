import { VerificationType } from 'src/users/enums/user-status.enum';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, BeforeInsert } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('verification_codes')
export class VerificationCode {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    email: string;

    @Column()
    code: string; // Mã 6 số, ví dụ: "123456"

    @Column()
    expires_at: Date;

    @Column({ type: 'jsonb', nullable: true })
    context_data?: any;

    @Column({ type: 'enum', enum: VerificationType, default: VerificationType.REGISTER })
    type: string;

    @CreateDateColumn()
    created_at: Date;

    @BeforeInsert()
    generateId() {
        if (!this.id) {
            this.id = uuidv4();
        }
    }
}