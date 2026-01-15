import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyChangeEmailDto {
    @ApiProperty({ example: 'newemail@gmail.com', description: 'Email mới muốn đổi' })
    @IsNotEmpty()
    @IsEmail()
    newEmail: string;

    @ApiProperty({ example: '123456', description: 'Mã OTP gửi về email CŨ' })
    @IsNotEmpty()
    @IsString()
    @Length(6, 6)
    code: string;
}