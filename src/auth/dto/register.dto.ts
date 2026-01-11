import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from "class-validator";

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

    @ApiProperty({
        example: 'Nguyễn Văn A',
        description: 'Họ và tên đầy đủ',
    })
    @IsNotEmpty({ message: 'Họ tên không được để trống' })
    @IsString()
    full_name: string;

    @ApiProperty({
        example: '0987654321',
        description: 'Số điện thoại (Chỉ chứa số, 10-11 ký tự)',
    })
    @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
    @IsString()
    @Matches(/^[0-9]+$/, { message: 'Số điện thoại chỉ được chứa ký tự số' })
    @MinLength(10, { message: 'Số điện thoại tối thiểu 10 số' })
    @MaxLength(11, { message: 'Số điện thoại tối đa 11 số' })
    phone_number: string;
}