import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan } from 'typeorm'; // Dùng DataSource để quản lý Transaction
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { UserSubscription } from './entities/user-subscription.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { User } from '../users/entities/user.entity';
import moment, { now } from 'moment';
import { SubscriptionStatus } from './enums/pricing.enum';
import { UserSubscriptionTier } from '../users/enums/user-status.enum';

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

    async updatePlan(id: string, dto: UpdatePlanDto) {
        const plan = await this.planRepository.findOne({ where: { id } });
        if (!plan) throw new NotFoundException('Plan not found');

        const updatedPlan = this.planRepository.merge(plan, dto);
        return this.planRepository.save(updatedPlan);
    }

    async findOnePlan(id: string) {
        const plan = await this.planRepository.findOne({ where: { id } });
        if (!plan) throw new NotFoundException('Plan not found');
        return plan;
    }

    async deletePlan(id: string) {
        const plan = await this.planRepository.findOne({ where: { id } });
        if (!plan) throw new NotFoundException('Plan not found');
        await this.planRepository.remove(plan);
        return { message: 'Deleted successfully' };
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
            let startDate = now;
            let endDate = moment().add(plan.duration_days, 'days').toDate();

            // check pricing ACTIVE by user
            const currentSub = await this.subscriptionRepository.findOne({
                where: {
                    user_id: userId,
                    status: SubscriptionStatus.ACTIVE,
                    end_date: MoreThan(now)
                },
                order: { end_date: 'DESC' }
            });

            // Nếu User đang có gói còn hạn, gói mới sẽ bắt đầu ngay sau khi gói cũ kết thúc.
            if (currentSub) {
                startDate = currentSub.end_date;
                endDate = moment(startDate).add(plan.duration_days, 'days').toDate();
            }

            const newSub = this.subscriptionRepository.create({
                user_id: userId,
                plan_id: plan.id,
                amount_paid: plan.price,
                start_date: startDate,
                end_date: endDate,
                status: SubscriptionStatus.PENDING, // Tạm thời để PENDING, sau khi thanh toán xong chuyển trạng tháng sang ACTIVE
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
                plan_name: plan.name,
                valid_from: startDate,
                valid_until: endDate
            };

        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Get current subscription 
     */
    async getCurrentSubscription(userId: string) {
        const now = new Date();

        const activeSub = await this.subscriptionRepository.findOne({
            where: {
                user_id: userId,
                status: SubscriptionStatus.ACTIVE,
                end_date: MoreThan(now)
            },
            relations: ['plan'],
            order: { end_date: 'DESC' }
        });

        if (!activeSub) return null;

        const daysLeft = moment(activeSub.end_date).diff(moment(now), 'days');

        return {
            ...activeSub,
            days_left: daysLeft,
            is_expired: false,
            plan_name: activeSub.plan.name
        }
    }

    /**
     * Huỷ gia hạn gói dịch vụ
     */
    async cancelRenewal(userId: string) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const currentSub = await this.subscriptionRepository.findOne({
                where: {
                    user_id: userId,
                    status: SubscriptionStatus.ACTIVE,
                    end_date: MoreThan(new Date())
                },
                order: { end_date: 'DESC' }
            });

            if (!currentSub) throw new BadRequestException('Bạn không có gói dịch vụ nào đang hoạt động để huỷ');

            if (currentSub.status === SubscriptionStatus.CANCELLED) throw new BadRequestException('Gói dịch vụ này đã được huỷ gia hạn trước đó');

            currentSub.status = SubscriptionStatus.CANCELLED;
            currentSub.updated_at = new Date();

            await queryRunner.manager.save(currentSub);

            // Update user profile immediately
            await queryRunner.manager.update(User, userId, {
                subscription_tier: UserSubscriptionTier.FREE,
                subscription_end_date: new Date()
            });

            await queryRunner.commitTransaction();

            return {
                message: 'Đã huỷ gia hạn thành công.',
                end_date: currentSub.end_date,
                cancellation_date: currentSub.updated_at
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