import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, Length, Matches } from 'class-validator';

export class ResetPasswordDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsNotEmpty({ message: 'Email không được để trống' })
    @IsEmail({}, { message: 'Email không đúng định dạng' })
    email: string;

    @ApiProperty({ description: 'Mã OTP nhận được trong mail', example: '123456' })
    @IsNotEmpty()
    @Length(6, 6)
    code: string;

    @ApiProperty({ example: 'NewPass123@' })
    @IsNotEmpty()
    @MinLength(6)
    @Matches(/(?=.*[A-Z])/, { message: 'Phải có chữ hoa' })
    @Matches(/(?=.*[!@#$%^&*])/, { message: 'Phải có ký tự đặc biệt' })
    newPassword: string;

    @ApiProperty({ example: 'NewPass123@' })
    @IsNotEmpty()
    confirmPassword: string;
}