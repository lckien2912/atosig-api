import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/users/entities/user.entity";
import { Repository } from "typeorm";
import { RegisterDto } from "./dto/register.dto";
import * as bcrypt from 'bcrypt';
import { LoginDto } from "./dto/login.dto";
import { UserRole, UserSubscriptionTier, KycStatus } from "src/users/enums/user-status.enum";
import { userInfo } from "os";
import moment from "moment";
import { VerificationCode } from "./entities/verification-code.entity";
import { MailerService } from "@nestjs-modules/mailer";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@Injectable()
export class AuthService {

    constructor(
        @InjectRepository(User) private userRepository: Repository<User>,
        private jwtService: JwtService,
        @InjectRepository(VerificationCode) private verifyRepo: Repository<VerificationCode>,
        @InjectRepository(User) private userRepo: Repository<User>,
        private readonly mailerService: MailerService,
        private configService: ConfigService
    ) { }

    async register(registerDto: RegisterDto) {
        const existing = await this.userRepository.findOne({ where: { email: registerDto.email } });
        if (existing) throw new BadRequestException('Email already exists');

        if (registerDto.password !== registerDto.confirmPassword) throw new BadRequestException('Password and confirm password do not match');

        const hashedPassword = await bcrypt.hash(registerDto.password, 10);

        const newUser = this.userRepository.create({
            ...registerDto,
            password: hashedPassword,
            full_name: registerDto.fullName ? registerDto.fullName : '',
            role: UserRole.USER,
            subscription_tier: UserSubscriptionTier.FREE,
            kyc_status: KycStatus.UNVERIFIED
        });

        await this.userRepository.save(newUser);

        return this.generateTokens(newUser);
    }

    async login(loginDto: LoginDto) {
        const user = await this.userRepository.findOne({
            where: { email: loginDto.email },
            select: ['id', 'email', 'password', 'role', 'full_name', 'subscription_tier']
        });

        if (!user) throw new BadRequestException('The email address does not exist in the system.');

        const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
        if (!isPasswordValid) throw new BadRequestException('Incorrect password');

        return this.generateTokens(user);
    }

    // Login web admin
    async adminLogin(loginDto: LoginDto) {
        const user = await this.userRepository.findOne({
            where: { email: loginDto.email },
            select: ['id', 'email', 'password', 'role', 'full_name', 'subscription_tier']
        });

        if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
            throw new UnauthorizedException('Incorrect administrator account or password.')
        }

        if (user.role !== UserRole.ADMIN) {
            throw new ForbiddenException('You do not have permission to access this resource.');
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
    async sendVerificationCode(email: string) {
        const user = await this.userRepo.findOne({ where: { email } });
        if (user && user.is_verified) {
            throw new BadRequestException('Email này đã được xác thực');
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();

        const expiresAt = moment().add(5, 'minutes').toDate();

        await this.verifyRepo.delete({ email });

        const verification = this.verifyRepo.create({
            email,
            code,
            expires_at: expiresAt
        });
        await this.verifyRepo.save(verification);

        try {
            await this.mailerService.sendMail({
                to: email,
                subject: `Mã xác thực ATOSIG`,
                template: 'verify',
                context: {
                    code: code,
                    email: email
                },
            });
            return { success: true, message: 'Mã xác thực đã được gửi tới email của bạn.' };
        } catch (error) {
            console.log(error);
            throw new BadRequestException('Không thể gửi email. Vui lòng thử lại sau.');
        }
    }

    // Check otp
    async verifyCode(email: string, code: string) {
        const record = await this.verifyRepo.findOne({
            where: { email, code }
        });

        if (!record) throw new BadRequestException('Mã xác thực không hợp lệ hoặc email không hợp lệ');

        if (new Date() > record.expires_at) {
            await this.verifyRepo.delete({ id: record.id });
            throw new BadRequestException('Mã xác thực đã hết hạn. Vui lòng lấy lại mã xác thực.');
        }

        const user = await this.userRepo.findOne({ where: { email } });
        if (user) {
            user.is_verified = true;
            await this.userRepo.save(user);

            await this.verifyRepo.delete({ id: record.id });

            return {
                success: true,
                is_new_user: false,
                message: 'Xác thực thành công',
                user_updated: !!user
            };
        } else {
            return {
                success: true,
                is_new_user: true,
                message: 'Xác thực email thành công. Vui lòng tạo mật khẩu.',
            };
        }
    }

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
            const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            user = this.userRepo.create({
                email,
                full_name: `${firstName} ${lastName}`.trim(),
                password: hashedPassword,
                google_id: googleId,
                avatar: picture,
                role: UserRole.USER,
                is_verified: true,
                subscription_tier: UserSubscriptionTier.FREE,
                kyc_status: KycStatus.UNVERIFIED
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

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = moment().add(5, 'minutes').toDate();

        await this.verifyRepo.delete({ email: dto.email });

        const verifyRecord = this.verifyRepo.create({
            email: dto.email,
            code,
            expires_at: expiresAt
        });
        await this.verifyRepo.save(verifyRecord);

        try {
            await this.mailerService.sendMail({
                to: dto.email,
                subject: '[ATOSIG] Khôi phục mật khẩu',
                template: 'verify',
                context: {
                    code: code,
                    email: dto.email,
                    description: 'Bạn đang yêu cầu đặt lại mật khẩu. Mã xác thực của bạn là:'
                },
            });
            return { message: `Mã xác thực đã được gửi tới ${dto.email}` };
        } catch (error) {
            console.log(error);
            throw new BadRequestException('Lỗi gửi email. Vui lòng thử lại sau.');
        }
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