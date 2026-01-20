import { Controller, Post, UseGuards, Req, UploadedFile, UseInterceptors, BadRequestException, Get, Patch, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiBody, ApiTags, ApiOperation } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyCodePassDto } from './dto/verify-code-pass.dto';
import { RequestEmailDto } from './dto/request-email.dto';
import { VerifyChangeEmailDto } from './dto/change-email.dto';
import * as fs from 'fs';

@ApiTags('Profile')
@Controller('profile')
export class ProfileController {
    constructor(private readonly profileService: ProfileService) { }

    @Get()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Lấy thông tin chi tiết user đang đăng nhập' })
    getProfile(@Req() req) {
        return this.profileService.getProfile(req.user.id);
    }

    @Post('avatar')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Upload Avatar (Lưu local)' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                    description: 'File ảnh (jpg, jpeg, png, gif), tối đa 5MB',
                },
            },
        },
    })
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: (req, file, cb) => {
                const uploadPath = './uploads';
                if (!fs.existsSync(uploadPath)) {
                    fs.mkdirSync(uploadPath, { recursive: true });
                }
                cb(null, uploadPath);
            },
            filename: (req, file, callback) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const ext = extname(file.originalname);
                callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
            },
        }),
        fileFilter: (req, file, callback) => {
            if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
                return callback(new BadRequestException('Chỉ chấp nhận file ảnh (jpg, jpeg, png, gif)!'), false);
            }
            callback(null, true);
        },
        limits: {
            fileSize: 5 * 1024 * 1024
        }
    }))
    async uploadAvatar(@Req() req, @UploadedFile() file: Express.Multer.File) {
        return this.profileService.updateAvatar(req.user.id, file);
    }

    @Patch('info')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Cập nhật tên hiển thị, số điện thoại' })
    updateProfile(@Req() req, @Body() dto: UpdateProfileDto) {
        return this.profileService.updateProfile(req.user.id, dto);
    }

    @Post('change-password/request')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Bước 1: Yêu cầu đổi mật khẩu',
        description: 'Kiểm tra mật khẩu cũ (nếu có) -> Gửi mã OTP về email'
    })
    requestChangePassword(@Req() req, @Body() dto: ChangePasswordDto) {
        return this.profileService.requestChangePassword(req.user.id, dto);
    }

    @Post('change-password/verify')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Bước 2: Xác thực OTP và Đổi mật khẩu mới',
        description: 'Gửi mã OTP nhận được trong mail + Mật khẩu mới để hoàn tất'
    })
    verifyChangePassword(@Req() req, @Body() dto: VerifyCodePassDto) {
        return this.profileService.verifyAndChangePassword(req.user.id, dto);
    }

    @Post('change-email/request')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Bước 1: Yêu cầu đổi Email',
        description: 'Gửi mã OTP xác thực về email HIỆN TẠI để chứng minh chính chủ'
    })
    requestEmailChange(@Req() req, @Body() dto: RequestEmailDto) {
        return this.profileService.requestEmailChange(req.user.id, dto);
    }

    @Post('change-email/verify')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Bước 2: Xác thực OTP và Cập nhật Email',
        description: 'Gửi mã OTP + Email Mới -> Hệ thống cập nhật email'
    })
    verifyEmailChange(@Req() req, @Body() dto: VerifyChangeEmailDto) {
        return this.profileService.verifyEmailChange(req.user.id, dto);
    }
}