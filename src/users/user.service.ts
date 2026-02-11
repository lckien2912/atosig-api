import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from './dto/pagination.dto';
import { UserRole, UserStatus } from './enums/user-status.enum';
import { UserSubscription } from '../pricing/entities/user-subscription.entity';
import { SubscriptionStatus } from 'src/pricing/enums/pricing.enum';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private usersRepository: Repository<User>,
    ) { }

    // =================================================================
    // 1. USER (Profile cá nhân)
    // =================================================================

    /**
     * Get Profile
     * @returns User
     */
    async findOne(id: string): Promise<User> {
        const user = await this.usersRepository.findOne({ where: { id } });
        if (!user) throw new NotFoundException(`User not found with id: ${id}`);
        return user;
    }

    /**
     * Update Profile
     * @param id
     * @param updateUserDto
     * @returns User
     */
    async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
        const user = await this.findOne(id);

        const updatedUser = this.usersRepository.merge(user, updateUserDto);

        return this.usersRepository.save(updatedUser);
    }

    // =================================================================
    // 2. ADMIN (Quản trị)
    // =================================================================


    /**
     * Get List User
     * @returns User[]
     */
    async findAll(query: PaginationDto) {
        const { page = 1, limit = 10, search } = query;
        const skip = (page - 1) * limit;

        const queryBuilder = this.usersRepository.createQueryBuilder('user');

        if (search) {
            queryBuilder.where(
                "(user.full_name ILIKE :search OR user.email ILIKE :search OR user.phone_number ILIKE :search)",
                { search: `%${search}%` }
            );
        }

        queryBuilder
            .leftJoinAndMapOne(
                'user.subscription',
                UserSubscription,
                'sub',
                'sub.user_id = user.id AND sub.status = :activeStatus',
                { activeStatus: SubscriptionStatus.ACTIVE }
            )
            .leftJoin('sub.plan', 'plan')
            .addSelect([
                'sub.id',
                'sub.payment_method',
                'plan.id',
                'plan.name',
                'plan.price',
                'plan.discount_percentage',
            ])
            .orderBy("user.created_at", "DESC")
            .skip(skip)
            .take(limit);

        const [users, total] = await queryBuilder.getManyAndCount();

        return {
            data: users,
            meta: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Deactivate User
     * @param id 
     * @returns 
     */
    async deactivate(id: string): Promise<void> {
        const user = await this.findOne(id);

        if (user.role === UserRole.ADMIN) {
            throw new ConflictException('Admin account cannot be locked.');
        }

        user.is_active = false;
        user.status = UserStatus.INACTIVE;

        await this.usersRepository.save(user);
    }

    /**
     * Restore User
     * @param id
     */
    async restore(id: string): Promise<void> {
        const user = await this.findOne(id);
        user.is_active = true;
        user.status = UserStatus.ACTIVE;
        await this.usersRepository.save(user);
    }


}
