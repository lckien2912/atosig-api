import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class CreateAffiliateOrderDto {
  @IsNotEmpty()
  @IsString()
  uid: string;

  @IsNotEmpty()
  @IsString()
  orderId: string;

  @IsNotEmpty()
  @IsString()
  orderName: string;

  @IsNotEmpty()
  @IsNumber()
  orderPayPrice: number;

  @IsNotEmpty()
  @IsNumber()
  orderActuallyPaid: number;
}
