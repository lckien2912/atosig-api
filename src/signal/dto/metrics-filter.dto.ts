import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class MetricsFilterDto {
    @ApiProperty({
        required: false,
        description: 'Khoảng thời gian (VD: 1M, 3M, 6M, 1Y, YTD, ALL)',
        example: '1M'
    })
    @IsOptional()
    @IsString()
    duration?: string;

    @ApiProperty({
        required: false,
        description: 'Ngày bắt đầu',
        example: '01/01/2026'
    })
    @IsOptional()
    @IsString()
    from?: string;

    @ApiProperty({
        required: false,
        description: 'Ngày kết thúc',
        example: '01/01/2026'
    })
    @IsOptional()
    @IsString()
    to?: string;
}