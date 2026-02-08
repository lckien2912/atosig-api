import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { DataSource } from 'typeorm';
import { UserSubscriptionTier } from '../src/users/enums/user-status.enum';
import moment from 'moment-timezone';
import { UserSubscription } from '../src/pricing/entities/user-subscription.entity';
import { SubscriptionPlan } from '../src/pricing/entities/subscription-plan.entity';
import { SubscriptionStatus } from '../src/pricing/enums/pricing.enum';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const dataSource = app.get(DataSource);
    const userRepo = dataSource.getRepository(User);

    const subscriptionRepo = dataSource.getRepository(UserSubscription);
    const planRepo = dataSource.getRepository(SubscriptionPlan);

    const emails = ['tuna0106a@gmail.com', 'thudaokt94@gmail.com'];
    const endDate = moment().add(30, 'days').toDate();

    const premiumPlan = await planRepo.findOne({
        where: { tier: UserSubscriptionTier.PREMIUM }
    });

    if (!premiumPlan) {
        console.warn('⚠️ No PREMIUM plan found in DB. Creating a dummy subscription without plan_id.');
    } else {
        console.log(`✅ Found Premium Plan: ${premiumPlan.name} (${premiumPlan.id})`);
    }

    console.log('--- Starting Manual User Tier Update ---');

    for (const email of emails) {
        const user = await userRepo.findOne({ where: { email } });
        if (user) {
            console.log(`Updating user: ${email}`);
            console.log(`Current Tier: ${user.subscription_tier}`);

            // 2. Create User Subscription
            const newSub = subscriptionRepo.create({
                user: user,
                plan: (premiumPlan || null) as any,
                amount_paid: 0,
                start_date: new Date(),
                end_date: endDate,
                status: SubscriptionStatus.ACTIVE,
                payment_method: 'MANUAL_UPGRADE',
                transaction_code: `MANUAL_${Date.now()}`
            });

            await subscriptionRepo.save(newSub);
            console.log(`✅ Created Subscription ID: ${newSub.id}`);

            // 3. Update User
            user.subscription_tier = UserSubscriptionTier.PREMIUM;
            user.subscription_end_date = endDate;

            await userRepo.save(user);
            console.log(`✅ Success: Updated ${email} to PREMIUM until ${endDate}`);
        } else {
            console.error(`❌ Error: User ${email} not found`);
        }
    }

    await app.close();
    process.exit(0);
}

bootstrap();
