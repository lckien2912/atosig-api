import { MailerService } from "@nestjs-modules/mailer";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ChangePasswordDto } from "src/profile/dto/change-password.dto";
import { VerificationCode } from "src/auth/entities/verification-code.entity";
import { User } from "src/users/entities/user.entity";
import { Repository } from "typeorm";
import * as bcrypt from 'bcrypt';
import moment from 'moment';
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { RequestEmailDto } from "./dto/request-email.dto";
import { VerifyChangeEmailDto } from "./dto/change-email.dto";
import { VerifyCodePassDto } from "./dto/verify-code-pass.dto";
import { ConfigService } from "@nestjs/config";
import { LoginType, VerificationType } from "src/users/enums/user-status.enum";

@Injectable()
export class ProfileService {
    constructor(
        @InjectRepository(User) private readonly userRepository: Repository<User>,
        @InjectRepository(VerificationCode) private verifyRepo: Repository<VerificationCode>,
        private readonly mailService: MailerService,
        private configService: ConfigService
    ) { }

    private sanitizeUser(user: User) {
        const userResponse = { ...user };
        delete (userResponse as any).password;
        return userResponse;
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
            context_data: data
        });
        await this.verifyRepo.save(verifyRecord);

        try {
            await this.mailService.sendMail({
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

    async getProfile(userId: string) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');
        return this.sanitizeUser(user);
    }

    async updateProfile(userId: string, dto: UpdateProfileDto) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        if (dto.full_name) user.full_name = dto.full_name;
        if (dto.phone_number) user.phone_number = dto.phone_number;

        const updatedUser = await this.userRepository.save(user);
        return { message: 'Update profile successfully', user: this.sanitizeUser(updatedUser) };
    }

    async updateAvatar(userId: string, file: Express.Multer.File) {
        if (!file) throw new BadRequestException('Vui lòng chọn file ảnh');

        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const appUrl = this.configService.get('APP_URL') + ':' + this.configService.get('PORT');
        const avatarUrl = `${appUrl}/uploads/${file.filename}`;

        user.avatar = avatarUrl;
        user.avatar_url = avatarUrl;

        await this.userRepository.save(user);

        return {
            message: 'Cập nhật ảnh đại diện thành công',
            avatar_url: avatarUrl
        };
    }

    async requestChangePassword(userId: string, dto: ChangePasswordDto) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const hashPassword = user.password && user.password.length > 0

        if (user.login_type === LoginType.GOOGLE && !hashPassword) {
            if (dto.newPassword !== dto.confirmPassword) throw new BadRequestException('Mật khẩu không khớp');
            user.password = await bcrypt.hash(dto.newPassword, 10);
            await this.userRepository.save(user);

            return {
                status: true,
                message: 'Thiết lập mật khẩu thành công'
            };
        } else {
            if (!dto.oldPassword) throw new BadRequestException('Vui lòng nhập mật khẩu cũ');

            if (user.password) {
                const isMatch = await bcrypt.compare(dto.oldPassword, user.password);
                if (!isMatch) throw new BadRequestException('Mật khẩu cũ không chính xác');
            }

            if (dto.newPassword !== dto.confirmPassword) throw new BadRequestException('Mật khẩu không khớp');

            return this.generateAndSendOtp(
                user.email,
                '[ATOSIG] Xác nhận thay đổi Mật khẩu',
                'Bạn đang yêu cầu thay đổi mật khẩu. Vui lòng nhập mã này để tiếp tục.',
                VerificationType.CHANGE_PASSWORD,
                {
                    newPassword: dto.newPassword
                }
            )
        }
    }

    async verifyAndChangePassword(userId: string, dto: VerifyCodePassDto) {

        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const record = await this.verifyRepo.findOne({
            where: { email: user.email, code: dto.code }
        });

        if (!record) throw new BadRequestException('Mã OTP không chính xác');
        if (new Date() > record.expires_at) throw new BadRequestException('Mã OTP đã hết hạn');

        const userData = record.context_data as { newPassword: string };
        user.password = await bcrypt.hash(userData.newPassword, 10);
        await this.userRepository.save(user);

        await this.verifyRepo.delete({ id: record.id });

        return { message: 'Change password successfully', user: this.sanitizeUser(user) };
    }

    async requestEmailChange(userId: string, dto: RequestEmailDto) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        if (user.email === dto.newEmail) throw new BadRequestException('Email đã tồn tại');

        const existing = await this.userRepository.findOne({ where: { email: dto.newEmail } });
        if (existing) throw new BadRequestException('Email này đã được sử dụng bởi tài khoản khác');

        return this.generateAndSendOtp(
            dto.newEmail,
            '[ATOSIG] Xác nhận thay đổi Email',
            'Bạn đang yêu cầu thay đổi email. Vui lòng nhập mã này để tiếp tục.',
            VerificationType.CHANGE_EMAIL,
            {
                newEmail: dto.newEmail
            }
        )
    }

    async verifyEmailChange(userId: string, dto: VerifyChangeEmailDto) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const recordOtp = await this.verifyRepo.findOne({
            where: { email: user.email, code: dto.code }
        });

        if (!recordOtp) throw new BadRequestException('Mã xác thực không đúng');
        if (new Date() > recordOtp.expires_at) throw new BadRequestException('Mã xác thực đã hết hạn');

        const userData = recordOtp.context_data as { newEmail: string };

        user.email = userData.newEmail;
        await this.userRepository.save(user);

        await this.verifyRepo.delete({ id: recordOtp.id });

        return { success: true, message: 'Cập nhật email thành công', new_email: user.email };
    }



}