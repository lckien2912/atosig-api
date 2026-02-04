import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsNumber } from "class-validator";
import { Type } from "class-transformer";

export class ProfitFactorFilterDto {
    @ApiProperty({
        required: false,
        example: 2026
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    year?: number;
}
