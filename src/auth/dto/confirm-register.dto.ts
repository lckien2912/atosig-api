import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class ConfirmRegisterDto {
    @ApiProperty({ example: 'nguyenvana@gmail.com' })
    @IsNotEmpty({ message: 'Email không được để trống' })
    @IsEmail({}, { message: 'Email không đúng định dạng' })
    email: string;

    @ApiProperty({ example: '123456', description: 'Mã OTP 6 số' })
    @IsNotEmpty({ message: 'Mã OTP không được để trống' })
    @IsString()
    @Length(6, 6)
    code: string;
}