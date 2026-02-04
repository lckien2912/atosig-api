import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsDate } from "class-validator";
import { Type } from "class-transformer";

export class MetricsFilterDto {
    @ApiProperty({
        required: false,
        example: '2026-01-01'
    })
    @IsOptional()
    @Type(() => Date)
    @IsDate()
    startDate?: Date;

    @ApiProperty({
        required: false,
        example: '2026-12-31'
    })
    @IsOptional()
    @Type(() => Date)
    @IsDate()
    endDate?: Date;
}