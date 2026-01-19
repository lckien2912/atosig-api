import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyCodePassDto {

    @ApiProperty({ description: 'Mã OTP gửi về email', example: '123456' })
    @IsNotEmpty()
    @IsString()
    @Length(6, 6)
    code: string;
}