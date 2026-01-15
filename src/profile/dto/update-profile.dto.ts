import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateProfileDto {
    @ApiProperty({ example: 'Nguyen Van B', description: 'Tên hiển thị mới' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    full_name?: string;

    @ApiProperty({ example: '0987654321', description: 'Số điện thoại' })
    @IsOptional()
    @IsString()
    @MaxLength(15)
    phone_number?: string;

}