import { IsNotEmpty, IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CreateAffiliateUserDto {
  @IsNotEmpty()
  @IsString()
  uid: string;

  @IsOptional()
  @IsString()
  refUid?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percent?: number;
}
