
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { KycStatus, UserRole, UserSubscriptionTier, LoginType } from '../users/enums/user-status.enum';

dotenv.config();

// Cấu hình thông tin Admin muốn tạo
const ADMIN_EMAIL = 'admin@atosig.com';
const ADMIN_PASSWORD = 'AdminPassword123@';
const ADMIN_NAME = 'Super Admin';

async function seedAdmin() {
    console.log('🌱 Starting seed admin...');

    const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_DATABASE || 'atosig_db',
        entities: [User],
        synchronize: false,
    });

    try {
        await dataSource.initialize();
        console.log('✅ Database connected');

        const userRepository = dataSource.getRepository(User);

        const existingAdmin = await userRepository.findOne({ where: { email: ADMIN_EMAIL } });

        if (existingAdmin) {
            console.log(`⚠️ Admin user ${ADMIN_EMAIL} already exists.`);

            // Optional: Update existing user to be admin if needed
            existingAdmin.role = UserRole.ADMIN;
            existingAdmin.is_verified = true;
            existingAdmin.status = 'ACTIVE';
            await userRepository.save(existingAdmin);
            console.log('🔄 Updated existing user to ADMIN role and verified status.');

        } else {
            console.log('🆕 Creating new admin user...');
            const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

            const newAdmin = userRepository.create({
                email: ADMIN_EMAIL,
                password: hashedPassword,
                full_name: ADMIN_NAME,
                role: UserRole.ADMIN,
                is_verified: true,
                is_active: true,
                status: 'ACTIVE',
                kyc_status: KycStatus.VERIFIED,
                subscription_tier: UserSubscriptionTier.PREMIUM,
                login_type: LoginType.EMAIL
            });

            await userRepository.save(newAdmin);
            console.log(`✅ Admin user ${ADMIN_EMAIL} created successfully!`);
        }

    } catch (error) {
        console.error('❌ Error seeding admin:', error);
    } finally {
        await dataSource.destroy();
        console.log('👋 Connection closed');
    }
}

seedAdmin();
