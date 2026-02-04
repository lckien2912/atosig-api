import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsDate, IsNumber, Min } from "class-validator";
import { Type } from "class-transformer";

export class SignalListFilterDto {
    @ApiProperty({
        required: false,
        example: 1
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiProperty({
        required: false,
        example: 10
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    limit?: number = 10;

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
