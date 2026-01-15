import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
    @ApiProperty({
        example: 'nguyenvana@gmail.com',
        description: 'Email đăng nhập (Duy nhất)',
    })
    @IsNotEmpty({ message: 'Email không được để trống' })
    @IsEmail({}, { message: 'Email không đúng định dạng' })
    email: string;

    @ApiProperty({
        example: 'Nguyen Van A',
    })
    @IsOptional()
    fullName?: string;

    @ApiProperty({
        example: 'MatKhau123!',
        description: 'Mật khẩu (1 hoa, 1 đặc biệt, Tối thiểu 6 ký tự)',
    })
    @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
    @IsString()
    @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
    @Matches(/(?=.*[A-Z])/, {
        message: 'Mật khẩu phải chứa ít nhất 1 ký tự viết hoa'
    })
    @Matches(/(?=.*[!@#$%^&*(),.?":{}|<>])/, {
        message: 'Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt (!@#$%^&*)'
    })
    password: string;

    @ApiProperty({
        example: 'MatKhau123!',
        description: 'Nhập lại Mật khẩu (1 hoa, 1 đặc biệt, Tối thiểu 6 ký tự)',
    })
    @IsNotEmpty({ message: 'Nhập lại Mật khẩu không được để trống' })
    @IsString()
    @MinLength(6, { message: 'Nhập lại Mật khẩu phải có ít nhất 6 ký tự' })
    @Matches(/(?=.*[A-Z])/, {
        message: 'Mật khẩu phải chứa ít nhất 1 ký tự viết hoa'
    })
    @Matches(/(?=.*[!@#$%^&*(),.?":{}|<>])/, {
        message: 'Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt (!@#$%^&*)'
    })
    confirmPassword: string;
}
