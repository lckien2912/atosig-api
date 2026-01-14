import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationType } from './enums/notification.enum';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationRead } from './entities/notification-read.entity';

@Injectable()
export class NotificationsService {
    constructor(
        @InjectRepository(Notification)
        private notiRepo: Repository<Notification>,
        @InjectRepository(NotificationRead)
        private readRepo: Repository<NotificationRead>,
        private notiGateway: NotificationsGateway
    ) { }

    // Tạo thông báo tín hiệu (Broadcast cho tất cả user)
    async createSignalNotification(data: {
        symbol: string;
        exchange: string;
        type: NotificationType;
        price: number;
        change_percent: number;
        signal_date?: Date;
    }) {
        let title = '';
        let body = '';
        const timestamp = data.signal_date || new Date();

        switch (data.type) {
            case NotificationType.SIGNAL_ENTRY:
                title = `${data.symbol} (${data.exchange}) - Tín hiệu mới`;
                body = `Entry point tại giá ${data.price}`;
                break;
            case NotificationType.SIGNAL_TP:
                title = `${data.symbol} (${data.exchange}) - Đạt TP`;
                body = `Chốt lời thành công tại ${data.price} (+${data.change_percent}%)`;
                break;
            case NotificationType.SIGNAL_SL:
                title = `${data.symbol} (${data.exchange}) - Chạm SL`;
                body = `Cắt lỗ tại ${data.price} (${data.change_percent}%)`;
                break;
            default:
                title = 'Thông báo hệ thống';
                body = 'Có cập nhật mới';
                break;
        }

        const notification = this.notiRepo.create({
            user_id: undefined,
            type: data.type,
            title,
            body,
            is_read: false,
            metadata: {
                symbol: data.symbol,
                exchange: data.exchange,
                price: data.price,
                change_percent: data.change_percent || 0,
                signal_type: data.type,
                timestamp: timestamp,
                created_by: 'BOT'
            }
        });

        const savedNoti = await this.notiRepo.save(notification);

        // Bắn Socket cho tất cả user đang online
        this.notiGateway.broadcastToAll(savedNoti);

        return savedNoti;
    }

    async broadcastFromAdmin(dto: CreateNotificationDto) {
        const type = dto.type || NotificationType.SYSTEM;

        const noti = this.notiRepo.create({
            user_id: dto.user_id || undefined,
            type,
            title: dto.title,
            body: dto.body,
            is_read: false,
            metadata: {
                ...(dto.metadata || {}),
                created_by: 'Admin'
            }
        });

        const savedNoti = await this.notiRepo.save(noti);

        if (savedNoti.user_id) {
            this.notiGateway.sendToUser(savedNoti.user_id, savedNoti);
        } else {
            this.notiGateway.broadcastToAll(savedNoti);
        }

        return savedNoti;
    }

    async findAll(userId: string, page: number = 1, limit: number = 20) {
        const notifications = await this.notiRepo.find({
            where: [
                { user_id: userId }, // Tin riêng
                { user_id: undefined }    // Tin chung
            ],
            order: { created_at: 'DESC' },
            skip: (page - 1) * limit,
            take: limit
        });

        if (notifications.length === 0) {
            return {
                items: [],
                meta: { total: 0, page, unread_count: 0 }
            };
        }

        const notiIds = notifications.map(n => n.id);

        const readRecords = await this.readRepo.find({
            where: {
                user_id: userId,
                notification_id: In(notiIds)
            },
            select: ['notification_id']
        });

        const readSet = new Set(readRecords.map(r => r.notification_id));

        const items = notifications.map(noti => {
            let isRead = false;
            if (noti.user_id) {
                isRead = noti.is_read;
            } else {
                isRead = readSet.has(noti.id);
            }

            let source = 'SYSTEM';
            if (noti.type === NotificationType.SYSTEM) source = 'ADMIN';
            else if (noti.type.toString().startsWith('SIGNAL')) source = 'BOT';

            if (noti.metadata && noti.metadata.created_by) {
                source = noti.metadata.created_by;
            }

            return {
                ...noti,
                is_read: isRead,
                source_label: source,
                is_admin: source === 'ADMIN'
            };
        });

        const countPrivateUnread = await this.notiRepo.count({
            where: { user_id: userId, is_read: false }
        });

        const total = await this.notiRepo.count({
            where: [{ user_id: userId }, { user_id: undefined }]
        });

        return {
            items: items,
            meta: {
                total,
                page,
                last_page: Math.ceil(total / limit),
                unread_private: countPrivateUnread
            }
        };


    }

    async markAsRead(notificationId: string, userId: string) {
        const noti = await this.notiRepo.findOne({ where: { id: notificationId } });
        if (!noti) throw new NotFoundException('Notification not found');

        if (noti.user_id) {
            if (noti.user_id !== userId) throw new ForbiddenException();
            await this.notiRepo.update(notificationId, { is_read: true });
        } else {
            const exists = await this.readRepo.findOne({
                where: { user_id: userId, notification_id: notificationId }
            });

            if (!exists) {
                await this.readRepo.save({
                    user_id: userId,
                    notification_id: notificationId
                });
            }
        }

        return { success: true };
    }

    async markAllRead(userId: string) {
        await this.notiRepo.update({ user_id: userId, is_read: false }, { is_read: true });

        const allGlobalNotis = await this.notiRepo.find({
            where: { user_id: undefined },
            select: ['id']
        });

        const readGlobals = await this.readRepo.find({
            where: { user_id: userId },
            select: ['notification_id']
        });

        const readSet = new Set(readGlobals.map(r => r.notification_id));

        const unreadGlobals = allGlobalNotis.filter(n => !readSet.has(n.id));

        if (unreadGlobals.length > 0) {
            const newReads = unreadGlobals.map(n => ({
                user_id: userId,
                notification_id: n.id
            }));
            await this.readRepo.save(newReads);
        }

        return { success: true };
    }
}