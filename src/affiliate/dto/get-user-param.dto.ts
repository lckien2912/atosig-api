import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetUserParamDto {
    @ApiProperty({ description: 'User ID', example: 'user123' })
    @IsNotEmpty()
    @IsString()
    uid: string;
}
