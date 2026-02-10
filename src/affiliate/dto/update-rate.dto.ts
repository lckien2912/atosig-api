import { IsNotEmpty, IsString, IsNumber, Min, Max } from 'class-validator';

export class UpdateRateDto {
    @IsNotEmpty()
    @IsString()
    sourceUid: string;

    @IsNotEmpty()
    @IsString()
    targetUid: string;

    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    @Max(100)
    rate: number;
}
