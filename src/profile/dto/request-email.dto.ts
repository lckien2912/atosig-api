import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class RequestEmailDto {
    @ApiProperty({ example: 'newemail@gmail.com', description: 'Email mới muốn đổi' })
    @IsNotEmpty()
    @IsEmail()
    newEmail: string;
}