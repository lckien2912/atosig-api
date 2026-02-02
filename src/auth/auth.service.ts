import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { OAuth2Client } from 'google-auth-library';
import { User } from "src/users/entities/user.entity";
import { DataSource, Repository } from "typeorm";
import { RegisterDto } from "./dto/register.dto";
import * as bcrypt from 'bcrypt';
import { LoginDto } from "./dto/login.dto";
import { UserRole, UserSubscriptionTier, KycStatus, VerificationType, LoginType } from "src/users/enums/user-status.enum";
import { VerificationCode } from "./entities/verification-code.entity";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { ConfirmRegisterDto } from "./dto/confirm-register.dto";
import { LoginGoogleDto } from "./dto/login-google.dto";
import { MailerService } from "@nestjs-modules/mailer";
import moment from "moment";

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User) private userRepository: Repository<User>,
        private jwtService: JwtService,
        @InjectRepository(VerificationCode) private verifyRepo: Repository<VerificationCode>,
        private readonly mailerService: MailerService,
        private configService: ConfigService,
        private dataSource: DataSource,
        private googleClient: OAuth2Client
    ) {
        const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
        this.googleClient = new OAuth2Client(clientId);
    }

    private async generateAndSendOtp(email: string, subject: string, description: string, type: string, data?: any) {
        await this.verifyRepo.delete({ email });

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = moment().add(5, 'minutes').toDate();

        const verifyRecord = this.verifyRepo.create({
            email,
            code,
            expires_at: expiresAt,
            type,
            context_data: data ? data : null
        });
        await this.verifyRepo.save(verifyRecord);

        try {
            await this.mailerService.sendMail({
                to: email,
                subject: subject,
                template: 'verify',
                context: {
                    title: subject,
                    code,
                    email,
                    description
                },
            });
            return { success: true, message: `Mã OTP đã gửi tới ${email}` };
        } catch (error) {
            console.error(error);
            throw new BadRequestException('Không thể gửi email OTP. Vui lòng thử lại sau.');
        }
    }

    async requestRegister(dto: RegisterDto) {
        const existing = await this.userRepository.findOne({ where: { email: dto.email } });
        if (existing) throw new BadRequestException('Email này đã đăng ký');

        if (dto.password !== dto.confirmPassword) throw new BadRequestException('Mật khẩu không khớp');

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        return this.generateAndSendOtp(
            dto.email,
            '[ATOSIG] OTP đăng ký tài khoản',
            'Bạn vừa yêu cầu mã xác thực để đăng ký tài khoản vào hệ thống.',
            VerificationType.REGISTER,
            {
                password: hashedPassword,
                full_name: dto.fullName || '',
            }
        );
    }

    async register(dto: ConfirmRegisterDto) {
        const record = await this.verifyRepo.findOne({
            where: { email: dto.email, code: dto.code }
        });

        if (!record) throw new BadRequestException('Mã OTP không hoặc email chính xác');
        if (new Date() > record.expires_at) throw new BadRequestException('Mã OTP đã hết hạn');

        if (record.type === VerificationType.REGISTER) {
            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();

            try {

                const userData = record.context_data;

                const newUser = this.userRepository.create({
                    email: record.email,
                    password: userData.password,
                    full_name: userData.full_name ? userData.full_name : record.email,
                    role: UserRole.USER,
                    subscription_tier: UserSubscriptionTier.FREE,
                    kyc_status: KycStatus.UNVERIFIED,
                    login_type: LoginType.EMAIL
                });
                await this.userRepository.save(newUser);

                await queryRunner.manager.delete(VerificationCode, { id: record.id });

                await queryRunner.commitTransaction();

                return this.generateTokens(newUser);

            } catch (error) {
                await queryRunner.rollbackTransaction();
                console.error(error);
                throw new BadRequestException('Có lỗi xảy ra khi tạo tài khoản. Vui lòng thử lại.');
            } finally {
                await queryRunner.release();
            }

        }
    }

    async login(loginDto: LoginDto) {
        const user = await this.userRepository.findOne({
            where: { email: loginDto.email },
            select: ['id', 'email', 'password', 'role', 'full_name', 'subscription_tier', 'is_active']
        });

        if (!user) throw new BadRequestException('Tài khoản không tồn tại');

        if (!user.is_active) throw new UnauthorizedException('Tài khoản đã bị khóa');

        const pass = user.password || '';

        const isPasswordValid = await bcrypt.compare(loginDto.password, pass);
        if (!isPasswordValid) throw new BadRequestException('Mật khẩu không chính xác.');

        return this.generateTokens(user);
    }

    // Login web admin
    async adminLogin(loginDto: LoginDto) {
        const user = await this.userRepository.findOne({
            where: { email: loginDto.email },
            select: ['id', 'email', 'password', 'role', 'full_name', 'subscription_tier']
        });

        if (!user) throw new BadRequestException('Tài khoản không tồn tại');

        const pass = user.password || '';

        if (!(await bcrypt.compare(loginDto.password, pass))) {
            throw new BadRequestException('Mật khẩu không chính xác.')
        }

        if (user.role !== UserRole.ADMIN) {
            throw new ForbiddenException('Bạn không có quyền truy cập');
        }

        return this.generateTokens(user);
    }

    generateTokens(user: User) {
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            is_verified: user.is_verified,
            subscription_tier: user.subscription_tier
        };

        const accessTime = this.configService.get<string>('JWT_ACCESS_EXPIRATION') || '1d';
        const refreshTime = this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '30d';

        const accessToken = this.jwtService.sign(payload, { expiresIn: accessTime as any });
        const refreshToken = this.jwtService.sign(payload, { expiresIn: refreshTime as any });

        // Remove password from response
        const { password, ...userInfo } = user;

        return {
            access_token: accessToken,
            refresh_token: refreshToken,
            user: userInfo
        }
    }

    async loginWithGoogle(dto: LoginGoogleDto) {
        try {
            const ticket = await this.googleClient.verifyIdToken({
                idToken: dto.token_id,
                audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
            });

            const payload = ticket.getPayload();
            if (!payload) {
                throw new UnauthorizedException('Token Google không hợp lệ');
            }

            const { email, given_name, picture, sub: googleId } = payload;

            if (!email) {
                throw new BadRequestException('Email không tồn tại trong token Google');
            }

            let user = await this.userRepository.findOne({ where: { email } });

            if (user) {
                if (!user.google_id) {
                    user.google_id = googleId;
                }

                if (!user.is_verified) {
                    user.is_verified = true;
                }

                if (!user.avatar && picture) {
                    user.avatar = picture;
                }

                await this.userRepository.save(user);

            } else {
                user = this.userRepository.create({
                    email,
                    full_name: `${given_name || ''}`.trim() || email,
                    google_id: googleId,
                    avatar: picture,
                    avatar_url: picture,
                    role: UserRole.USER,
                    is_verified: true,
                    is_set_pass: false,
                    subscription_tier: UserSubscriptionTier.FREE,
                    kyc_status: KycStatus.UNVERIFIED,
                    login_type: LoginType.GOOGLE
                });

                await this.userRepository.save(user);
            }

            return this.generateTokens(user);
        } catch (error) {
            console.error('Google login error:', error);
            if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
                throw error;
            }
            throw new UnauthorizedException('Xác thực Google thất bại');
        }
    }

    async forgotPassword(dto: ForgotPasswordDto) {
        const user = await this.userRepository.findOne({ where: { email: dto.email } });
        if (!user) throw new BadRequestException('Email không tồn tại');

        await this.generateAndSendOtp(
            dto.email,
            '[ATOSIG] Khôi phục mật khẩu',
            'Bạn vừa yêu cầu mã xác thực để khôi phục mật khẩu.',
            VerificationType.FORGOT_PASSWORD,
        );
    }

    async resetPassword(dto: ResetPasswordDto) {
        if (dto.newPassword !== dto.confirmPassword) {
            throw new BadRequestException('Mật khẩu xác nhận không khớp');
        }

        const record = await this.verifyRepo.findOne({
            where: { email: dto.email, code: dto.code }
        });

        if (!record) throw new BadRequestException('Mã xác thực không đúng');
        if (new Date() > record.expires_at) {
            await this.verifyRepo.delete({ id: record.id });
            throw new BadRequestException('Mã xác thực đã hết hạn');
        }

        const user = await this.userRepository.findOne({ where: { email: dto.email } });
        if (!user) throw new NotFoundException('User not found');

        const salt = await bcrypt.genSalt();
        const hashedPassword = await bcrypt.hash(dto.newPassword, salt);

        user.password = hashedPassword;
        await this.userRepository.save(user);

        await this.verifyRepo.delete({ id: record.id });

        return { success: true, message: 'Đặt lại mật khẩu thành công' };
    }

}