import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreateNotificationDto } from './dto/create-notification.dto'; // Nhớ import DTO này
import { RolesGuard } from 'src/auth/guards/roles.guard';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notiService: NotificationsService) { }

    @Get()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Lấy danh sách thông báo (Phân trang)' })
    async getNotifications(
        @Request() req,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20
    ) {
        return this.notiService.findAll(req.user.id, Number(page), Number(limit));
    }

    @Patch(':id/read')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Đánh dấu 1 thông báo là đã đọc' })
    async markAsRead(@Request() req, @Param('id') id: string) {
        return this.notiService.markAsRead(id, req.user.id);
    }

    @Patch('read-all')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Đánh dấu tất cả là đã đọc' })
    async markAllAsRead(@Request() req) {
        return this.notiService.markAllRead(req.user.id);
    }

    @Post('admin/send')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: '[ADMIN] Gửi thông báo thủ công (Bảo trì, Update...)' })
    async createAdminNotification(@Body() dto: CreateNotificationDto) {
        return this.notiService.broadcastFromAdmin(dto);
    }
}