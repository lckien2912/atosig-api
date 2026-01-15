import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';

import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { User } from 'src/users/entities/user.entity';
import { VerificationCode } from 'src/auth/entities/verification-code.entity';
import { MailModule } from 'src/mail/mail.module';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, VerificationCode]),
        MulterModule.register({
            dest: './uploads',
        }),
        MailModule,
        ConfigModule
    ],
    controllers: [ProfileController],
    providers: [ProfileService],
})
export class ProfileModule { }