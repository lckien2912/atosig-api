import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MinLength, Matches, Length } from 'class-validator';

export class ChangePasswordDto {
    @ApiProperty({ description: 'Mật khẩu cũ (Bắt buộc nếu user đã có mật khẩu)' })
    @IsOptional() // Optional vì user Google có thể chưa có pass
    @IsString()
    oldPassword?: string;

    @ApiProperty({ description: 'Mật khẩu mới' })
    @IsNotEmpty()
    @IsString()
    @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
    @Matches(/(?=.*[A-Z])/, { message: 'Phải chứa ký tự hoa' })
    @Matches(/(?=.*[!@#$%^&*])/, { message: 'Phải chứa ký tự đặc biệt' })
    newPassword: string;

    @ApiProperty({ description: 'Nhập lại mật khẩu mới' })
    @IsNotEmpty()
    @IsString()
    confirmPassword: string;
}