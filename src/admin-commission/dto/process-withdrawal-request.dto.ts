import { IsOptional, IsString, IsDateString } from 'class-validator';

export class ProcessWithdrawalRequestDto {
    @IsOptional()
    @IsString()
    adminNote?: string;

    @IsOptional()
    @IsDateString()
    holdUntil?: string;
}
