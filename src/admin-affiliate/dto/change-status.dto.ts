import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { AffiliateStatus } from 'src/users/enums/user-status.enum';

export class ChangeStatusDto {
    @IsEnum(AffiliateStatus)
    status: AffiliateStatus;

    @IsString()
    @IsNotEmpty()
    reason: string;
}
