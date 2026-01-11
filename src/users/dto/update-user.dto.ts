import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto {
    @ApiProperty({ example: 'Nguyễn Văn B', required: false })
    @IsOptional()
    @IsString()
    full_name?: string;

    @ApiProperty({ example: '0988888888', required: false })
    @IsOptional()
    @IsString()
    @Matches(/^[0-9]+$/, { message: 'Số điện thoại chỉ được chứa ký tự số' })
    @MinLength(10)
    @MaxLength(11)
    phone_number?: string;

    // @ApiProperty({ example: 'https://example.com/avatar.jpg', required: false })
    // @IsOptional()
    // @IsString()
    // avatar_url?: string;

    // @ApiProperty({ example: '012345678912', description: 'CCCD', required: false })
    // @IsOptional()
    // @IsString()
    // citizen_id?: string;
}