import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/users/entities/user.entity";
import { DataSource, Repository } from "typeorm";
import { RegisterDto } from "./dto/register.dto";
import * as bcrypt from 'bcrypt';
import { LoginDto } from "./dto/login.dto";
import { UserRole, UserSubscriptionTier, KycStatus, VerificationType, LoginType } from "src/users/enums/user-status.enum";
import { userInfo } from "os";
import { VerificationCode } from "./entities/verification-code.entity";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { ConfirmRegisterDto } from "./dto/confirm-register.dto";
import { MailerService } from "@nestjs-modules/mailer";
import moment from "moment";

@Injectable()
export class AuthService {

    constructor(
        @InjectRepository(User) private userRepository: Repository<User>,
        private jwtService: JwtService,
        @InjectRepository(VerificationCode) private verifyRepo: Repository<VerificationCode>,
        @InjectRepository(User) private userRepo: Repository<User>,
        private readonly mailerService: MailerService,
        private configService: ConfigService,
        private dataSource: DataSource
    ) { }

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
            '',
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
                    password: userData.password ? userData.password : '',
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
            select: ['id', 'email', 'password', 'role', 'full_name', 'subscription_tier']
        });

        if (!user) throw new BadRequestException('Tài khoản không tồn tại');

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
            throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác.')
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

    // Verify email, send opt
    // async sendVerificationCode(email: string) {
    //     const user = await this.userRepo.findOne({ where: { email } });
    //     if (user && user.is_verified) {
    //         throw new BadRequestException('Email này đã được xác thực');
    //     }

    //     const code = Math.floor(100000 + Math.random() * 900000).toString();

    //     const expiresAt = moment().add(5, 'minutes').toDate();

    //     await this.verifyRepo.delete({ email });

    //     const verification = this.verifyRepo.create({
    //         email,
    //         code,
    //         expires_at: expiresAt
    //     });
    //     await this.verifyRepo.save(verification);

    //     try {
    //         await this.mailerService.sendMail({
    //             to: email,
    //             subject: `[ATOSIG] Mã xác thực`,
    //             template: 'verify',
    //             context: {
    //                 code: code,
    //                 email: email
    //             },
    //         });
    //         return { success: true, message: 'Mã xác thực đã được gửi tới email của bạn.' };
    //     } catch (error) {
    //         console.log(error);
    //         throw new BadRequestException('Không thể gửi email. Vui lòng thử lại sau.');
    //     }
    // }

    // Check otp
    // async verifyCode(email: string, code: string) {
    //     const record = await this.verifyRepo.findOne({
    //         where: { email, code }
    //     });

    //     if (!record) throw new BadRequestException('Mã xác thực không hợp lệ hoặc email không hợp lệ');

    //     if (new Date() > record.expires_at) {
    //         await this.verifyRepo.delete({ id: record.id });
    //         throw new BadRequestException('Mã xác thực đã hết hạn. Vui lòng lấy lại mã xác thực.');
    //     }

    //     const user = await this.userRepo.findOne({ where: { email } });
    //     if (user) {
    //         user.is_verified = true;
    //         await this.userRepo.save(user);

    //         await this.verifyRepo.delete({ id: record.id });

    //         return {
    //             success: true,
    //             is_new_user: false,
    //             message: 'Xác thực thành công',
    //             user_updated: !!user
    //         };
    //     } else {
    //         return {
    //             success: true,
    //             is_new_user: true,
    //             message: 'Xác thực email thành công. Vui lòng tạo mật khẩu.',
    //         };
    //     }
    // }

    async loginWithGoogle(googleUser: any) {
        const { email, firstName, lastName, picture, googleId } = googleUser;

        let user = await this.userRepo.findOne({ where: { email } });

        if (user) {
            if (!user.google_id || user.google_id == undefined || user.google_id == null) {
                user.google_id = googleId;
            }

            if (!user.is_verified) {
                user.is_verified = true;
            }

            if ((!user.avatar || user.avatar == undefined || user.avatar == null) && picture) {
                user.avatar = picture;
            }

            await this.userRepo.save(user);

        } else {
            user = this.userRepo.create({
                email,
                full_name: `${firstName} ${lastName}`.trim(),
                password: '',
                google_id: googleId,
                avatar: picture,
                role: UserRole.USER,
                is_verified: true,
                subscription_tier: UserSubscriptionTier.FREE,
                kyc_status: KycStatus.UNVERIFIED,
                login_type: LoginType.GOOGLE
            });

            await this.userRepo.save(user);
        }

        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            is_verified: user.is_verified
        };

        return {
            access_token: this.jwtService.sign(payload, { expiresIn: '1d' }),
            user
        }
    }

    async forgotPassword(dto: ForgotPasswordDto) {
        const user = await this.userRepo.findOne({ where: { email: dto.email } });
        if (!user) throw new BadRequestException('Email không hợp lệ');

        await this.generateAndSendOtp(
            dto.email,
            '[ATOSIG] Khôi phục mật khẩu',
            '',
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

        if (!record) throw new BadRequestException('Mã xác thực không đúng hoặc email sai');
        if (new Date() > record.expires_at) {
            await this.verifyRepo.delete({ id: record.id });
            throw new BadRequestException('Mã xác thực đã hết hạn');
        }

        const user = await this.userRepo.findOne({ where: { email: dto.email } });
        if (!user) throw new NotFoundException('User not found');

        const salt = await bcrypt.genSalt();
        const hashedPassword = await bcrypt.hash(dto.newPassword, salt);

        user.password = hashedPassword;
        await this.userRepo.save(user);

        await this.verifyRepo.delete({ id: record.id });

        return { success: true, message: 'Đặt lại mật khẩu thành công' };
    }

}