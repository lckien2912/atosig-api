import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm'; // Dùng DataSource để quản lý Transaction
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { UserSubscription } from './entities/user-subscription.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { User } from '../users/entities/user.entity';
import moment from 'moment';
import { SubscriptionStatus } from './enums/pricing.enum';

@Injectable()
export class PricingService {
    constructor(
        @InjectRepository(SubscriptionPlan)
        private planRepository: Repository<SubscriptionPlan>,
        @InjectRepository(UserSubscription)
        private subscriptionRepository: Repository<UserSubscription>,
        private dataSource: DataSource,
    ) { }

    // ================================
    // ADMIN: QUẢN LÝ GÓI 
    // ================================

    async createPlan(dto: CreatePlanDto) {
        const plan = this.planRepository.create(dto);
        return this.planRepository.save(plan);
    }

    async findAllPlans(isAdmin: boolean = false) {
        // Nếu là Admin thì lấy hết, nếu là User chỉ lấy gói đang active
        const where = isAdmin ? {} : { is_active: true };
        return this.planRepository.find({
            where,
            order: { price: 'ASC' }
        });
    }

    async togglePlanStatus(id: string) {
        const plan = await this.planRepository.findOne({ where: { id } });
        if (!plan) throw new NotFoundException('Plan not found');
        plan.is_active = !plan.is_active;
        return this.planRepository.save(plan);
    }

    // ================================
    // USER: MUA GÓI 
    // ================================

    /**
     * User đăng ký mua gói.
     * Logic: Tạo record Subscription -> (Mock Payment) -> Update User Tier -> Active
     */
    async subscribe(userId: string, planId: string) {
        const plan = await this.planRepository.findOne({ where: { id: planId, is_active: true } });
        if (!plan) throw new NotFoundException('Gói dịch vụ không tồn tại hoặc đã ngừng bán');

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const now = new Date();
            const endDate = moment().add(plan.duration_days, 'days').toDate();

            const newSub = this.subscriptionRepository.create({
                user_id: userId,
                plan_id: plan.id,
                amount_paid: plan.price,
                start_date: now,
                end_date: endDate,
                status: SubscriptionStatus.ACTIVE, // Tạm thời để ACTIVE luôn (coi như đã thanh toán xong)
                payment_method: 'MOCK_PAYMENT',
                transaction_code: `TXN_${Date.now()}`
            });

            await queryRunner.manager.save(newSub);

            await queryRunner.manager.update(User, userId, {
                subscription_tier: plan.tier,
                subscription_end_date: endDate
            });

            await queryRunner.commitTransaction();

            return {
                message: 'Register subscription successfully',
                subscription: newSub,
                plan_name: plan.name
            };

        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Lấy lịch sử đăng ký của User
     */
    async getMySubscriptions(userId: string) {
        return this.subscriptionRepository.find({
            where: { user_id: userId },
            relations: ['plan'],
            order: { created_at: 'DESC' }
        });
    }
}