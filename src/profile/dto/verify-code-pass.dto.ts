import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, MinLength, Matches } from 'class-validator';

export class VerifyCodePassDto {

    @ApiProperty({ description: 'Mật khẩu mới' })
    @IsNotEmpty()
    @IsString()
    @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
    @Matches(/(?=.*[A-Z])/, { message: 'Phải chứa ký tự hoa' })
    @Matches(/(?=.*[!@#$%^&*])/, { message: 'Phải chứa ký tự đặc biệt' })
    newPassword: string;

    @ApiProperty({ description: 'Mã OTP gửi về email', example: '123456' })
    @IsNotEmpty()
    @IsString()
    @Length(6, 6)
    code: string;
}