import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WithdrawalRequestStatus } from '../enums/withdrawal-request-status.enum';

export class ProcessWithdrawalDto {
    @ApiProperty({ description: 'New status', enum: [WithdrawalRequestStatus.ACCEPTED, WithdrawalRequestStatus.REJECTED] })
    @IsEnum(WithdrawalRequestStatus)
    status: WithdrawalRequestStatus.ACCEPTED | WithdrawalRequestStatus.REJECTED;

    @ApiPropertyOptional({ description: 'Admin note', example: 'Transferred to bank account' })
    @IsOptional()
    @IsString()
    admin_note?: string;
}
