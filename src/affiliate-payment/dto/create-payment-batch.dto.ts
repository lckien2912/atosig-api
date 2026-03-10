import { IsArray, ArrayMinSize, ArrayMaxSize, IsUUID, IsDateString, IsNotEmpty, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentMethod } from 'src/affiliate/enums/payment-method.enum';

export class CreatePaymentBatchDto {
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(200)
    @IsUUID('4', { each: true })
    withdrawalRequestIds: string[];

    @IsDateString()
    @IsNotEmpty()
    paymentDate: string;

    @IsEnum(PaymentMethod)
    @IsNotEmpty()
    paymentMethod: PaymentMethod;

    @IsOptional()
    @IsString()
    transactionId?: string;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsString()
    batchName?: string;
}
