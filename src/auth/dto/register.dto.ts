import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
    @ApiProperty({
        example: 'nguyenvana@gmail.com',
        description: 'Email đăng nhập (Duy nhất)',
    })
    @IsNotEmpty({ message: 'Email không được để trống' })
    @IsEmail({}, { message: 'Email không đúng định dạng' })
    email: string;

    @ApiProperty({
        example: 'MatKhau123!',
        description: 'Mật khẩu (Tối thiểu 6 ký tự)',
    })
    @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
    @IsString()
    @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
    password: string;
}
