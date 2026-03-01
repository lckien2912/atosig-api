import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWithdrawalRequestDto {
    @ApiPropertyOptional({ description: 'Note from user', example: 'Please process ASAP' })
    @IsOptional()
    @IsString()
    note?: string;
}
