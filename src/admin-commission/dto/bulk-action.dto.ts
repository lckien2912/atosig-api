import { IsArray, ArrayMinSize, ArrayMaxSize, IsUUID, IsEnum, IsString, IsNotEmpty } from 'class-validator';

export enum BulkActionType {
    APPROVE = 'APPROVE',
    REJECT = 'REJECT',
    HOLD = 'HOLD'
}

export class BulkActionDto {
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(100)
    @IsUUID('4', { each: true })
    ids: string[];

    @IsEnum(BulkActionType)
    action: BulkActionType;

    @IsString()
    @IsNotEmpty()
    reason: string;
}
