import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private logger: Logger = new Logger('NotificationsGateway');

    private userSockets = new Map<string, string[]>();

    constructor(
        private jwtService: JwtService,
        private configService: ConfigService
    ) { }

    afterInit(server: Server) {
        this.logger.log('WebSocket Gateway Initialized');
    }

    // Khi Client kết nối vào
    async handleConnection(client: Socket) {
        try {
            const authHeader = client.handshake.auth.token || client.handshake.headers.authorization;

            if (!authHeader) {
                this.logger.warn(`Client ${client.id} has no token. Disconnecting...`);
                client.disconnect();
                return;
            }

            const token = authHeader.replace('Bearer ', '');
            const payload = this.jwtService.verify(token, {
                secret: this.configService.get('JWT_SECRET'),
            });

            const userId = payload.sub;

            client.data.userId = userId;
            await client.join(`user_${userId}`);
            await client.join('global_notifications');

            this.logger.log(`Client ${client.id} (User: ${userId}) connected & joined rooms.`);

        } catch (err) {
            this.logger.error('Connection unauthorized');
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    // Hàm gửi thông báo đến 1 User cụ thể
    sendToUser(userId: string, data: any) {
        this.server.to(`user_${userId}`).emit('new_notification', data);
        this.logger.debug(`Sent private noti to User ${userId}`);
    }

    // Hàm gửi thông báo đến TẤT CẢ User (Dùng cho Tín hiệu Trading)
    broadcastToAll(data: any) {
        this.server.to('global_signals').emit('new_notification', data);
        this.logger.debug(`Broadcasted signal: ${data.title}`);
    }
}