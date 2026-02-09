import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsOptional } from "class-validator";

export class LoginGoogleDto {
    @ApiProperty({
        description: 'Google ID Token from frontend (next-auth)',
        example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjYzMzM...'
    })
    @IsNotEmpty({ message: 'Token ID là bắt buộc' })
    @IsString()
    token_id: string;

    @ApiProperty({
        description: 'Referral code from frontend (next-auth)',
        example: 'REF123456'
    })
    @IsString()
    @IsOptional()
    ref_code?: string;
}
