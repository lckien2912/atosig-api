import { IsEnum, IsNotEmpty, IsOptional, IsString, IsObject } from 'class-validator';
import { NotificationType } from '../enums/notification.enum';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNotificationDto {
    @ApiProperty({ description: 'Tiêu đề thông báo' })
    @IsNotEmpty()
    @IsString()
    title: string;

    @ApiProperty({ description: 'Nội dung thông báo' })
    @IsNotEmpty()
    @IsString()
    body: string;

    @ApiProperty({ enum: NotificationType, default: NotificationType.SYSTEM })
    @IsEnum(NotificationType)
    @IsOptional()
    type?: NotificationType;

    @ApiProperty({ description: 'User ID (Để trống nếu muốn gửi cho tất cả)' })
    @IsOptional()
    @IsString()
    user_id?: string;

    @ApiProperty({ description: 'Dữ liệu thêm (JSON) để FE render màu sắc/icon' })
    @IsOptional()
    @IsObject()
    metadata?: any;
}