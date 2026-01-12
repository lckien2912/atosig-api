import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/users/entities/user.entity";
import { Repository } from "typeorm";
import { RegisterDto } from "./dto/register.dto";
import * as bcrypt from 'bcrypt';
import { LoginDto } from "./dto/login.dto";
import { UserRole, UserSubscriptionTier, KycStatus } from "src/users/enums/user-status.enum";
import { userInfo } from "os";

@Injectable()
export class AuthService {

    constructor(
        @InjectRepository(User) private userRepository: Repository<User>,
        private jwtService: JwtService,
        private configService: ConfigService
    ) { }

    async register(registerDto: RegisterDto) {
        const existing = await this.userRepository.findOne({ where: { email: registerDto.email } });
        if (existing) throw new BadRequestException('Email already exists');

        const hashedPassword = await bcrypt.hash(registerDto.password, 10);

        const newUser = this.userRepository.create({
            ...registerDto,
            password: hashedPassword,
            role: UserRole.USER,
            subscription_tier: UserSubscriptionTier.FREE,
            kyc_status: KycStatus.UNVERIFIED
        });

        await this.userRepository.save(newUser);

        return this.generateTokens(newUser);
    }

    async login(loginDto: LoginDto) {
        const user = await this.userRepository.findOne({
            where: { email: loginDto.email },
            select: ['id', 'email', 'password', 'role', 'full_name', 'subscription_tier']
        });

        if (!user) throw new BadRequestException('The email address does not exist in the system.');

        const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
        if (!isPasswordValid) throw new BadRequestException('Incorrect password');

        return this.generateTokens(user);
    }

    // Login web admin
    async adminLogin(loginDto: LoginDto) {
        const user = await this.userRepository.findOne({
            where: { email: loginDto.email },
            select: ['id', 'email', 'password', 'role', 'full_name', 'subscription_tier']
        });

        if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
            throw new UnauthorizedException('Incorrect administrator account or password.')
        }

        if (user.role !== UserRole.ADMIN) {
            throw new ForbiddenException('You do not have permission to access this resource.');
        }

        return this.generateTokens(user);
    }

    generateTokens(user: User) {
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role
        };

        const accessTime = this.configService.get<string>('JWT_ACCESS_EXPIRATION') || '1d';
        const refreshTime = this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '30d';

        const accessToken = this.jwtService.sign(payload, { expiresIn: accessTime as any });
        const refreshToken = this.jwtService.sign(payload, { expiresIn: refreshTime as any });

        // Remove password from response
        const { password, ...userInfo } = user;

        return {
            access_token: accessToken,
            refresh_token: refreshToken,
            user: userInfo
        }
    }
}