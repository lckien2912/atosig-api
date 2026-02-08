import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { DataSource } from 'typeorm';
import { UserSubscriptionTier } from '../src/users/enums/user-status.enum';
import moment from 'moment-timezone';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const dataSource = app.get(DataSource);
    const userRepo = dataSource.getRepository(User);

    const emails = ['tuna0106a@gmail.com', 'thudaokt94@gmail.com'];
    const endDate = moment().add(30, 'days').toDate();

    console.log('--- Starting Manual User Tier Update ---');

    for (const email of emails) {
        const user = await userRepo.findOne({ where: { email } });
        if (user) {
            console.log(`Updating user: ${email}`);
            console.log(`Current Tier: ${user.subscription_tier}`);

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
