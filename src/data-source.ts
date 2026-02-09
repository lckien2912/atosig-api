import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { User } from './users/entities/user.entity';
import { VerificationCode } from './auth/entities/verification-code.entity';
import { Signal } from './signal/entities/signal.entity';
import { UserFavorite } from './signal/entities/user-favorite.entity';
import { Company } from './company/entities/company.entity';
import { SubscriptionPlan } from './pricing/entities/subscription-plan.entity';
import { UserSubscription } from './pricing/entities/user-subscription.entity';
import { PaymentTransaction } from './payment/entities/payment-transaction.entity';
import { Notification } from './notification/entities/notification.entity';
import { NotificationRead } from './notification/entities/notification-read.entity';

const isCompiled = __filename.endsWith('.js');
const migrationsDir = isCompiled ? join(__dirname, 'migrations', '*.js') : join(__dirname, 'migrations', '*.ts');

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'atosig',
  entities: [
    User,
    VerificationCode,
    Signal,
    UserFavorite,
    Company,
    SubscriptionPlan,
    UserSubscription,
    PaymentTransaction,
    Notification,
    NotificationRead,
  ],
  migrations: [migrationsDir],
  migrationsTableName: 'migrations',
  logging: true,
  synchronize: false,
});
