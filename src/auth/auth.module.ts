import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OAuth2Client } from "google-auth-library";
import { User } from "../users/entities/user.entity";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { OptionalJwtAuthGuard } from "./guards/optional-jwt-auth.guard";
import { MailModule } from "src/mail/mail.module";
import { VerificationCode } from "./entities/verification-code.entity";
import { AffiliateModule } from "src/affiliate/affiliate.module";

@Module({
    imports: [
        TypeOrmModule.forFeature([User, VerificationCode]),
        MailModule,
        AffiliateModule,
        PassportModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET') || 'yourSecretKey',
                signOptions: { expiresIn: '7d' },
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy, OptionalJwtAuthGuard, OAuth2Client],
    exports: [AuthService],
})
export class AuthModule { }
