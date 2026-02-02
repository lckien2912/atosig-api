import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private configService: ConfigService,
        @InjectRepository(User) private userRepository: Repository<User>,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET') || 'yourSecretKey'
        });
    }

    async validate(payload: any) {
        const user = await this.userRepository.findOne({ where: { id: payload.sub }, select: ['id', 'email', 'role', 'subscription_tier', 'is_active'] });

        if (user && !user.is_active) throw new UnauthorizedException('Tài khoản đã bị khóa');

        return user;
    }
}
