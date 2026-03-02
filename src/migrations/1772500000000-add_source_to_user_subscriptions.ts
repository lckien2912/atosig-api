import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSourceToUserSubscriptions1772500000000 implements MigrationInterface {
    name = 'AddSourceToUserSubscriptions1772500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "user_subscriptions_source_enum" AS ENUM('USER', 'ADMIN')`);
        await queryRunner.query(`ALTER TABLE "user_subscriptions" ADD "source" "user_subscriptions_source_enum" NOT NULL DEFAULT 'USER'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_subscriptions" DROP COLUMN "source"`);
        await queryRunner.query(`DROP TYPE "user_subscriptions_source_enum"`);
    }
}
