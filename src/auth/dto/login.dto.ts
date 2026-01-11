import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class LoginDto {
    @ApiProperty({
        example: 'user@example.com',
        description: 'Email đăng nhập',
    })
    @IsNotEmpty({ message: 'Email không được để trống' })
    @IsEmail({}, { message: 'Email không đúng định dạng' })
    email: string;

    @ApiProperty({
        example: '123456',
        description: 'Mật khẩu',
    })
    @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
    @IsString()
    password: string;
}