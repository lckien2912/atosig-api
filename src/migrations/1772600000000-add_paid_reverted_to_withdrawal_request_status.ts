import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaidRevertedToWithdrawalRequestStatus1772600000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "affiliate_withdrawal_requests_status_enum" ADD VALUE IF NOT EXISTS 'PAID'`);
        await queryRunner.query(`ALTER TYPE "affiliate_withdrawal_requests_status_enum" ADD VALUE IF NOT EXISTS 'REVERTED'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // PostgreSQL does not support removing values from an enum type directly.
        // To revert, recreate the enum without PAID/REVERTED and cast existing data.
        await queryRunner.query(`
            ALTER TABLE "affiliate_withdrawal_requests"
                ALTER COLUMN "status" TYPE text;
        `);
        await queryRunner.query(`DROP TYPE "affiliate_withdrawal_requests_status_enum"`);
        await queryRunner.query(`CREATE TYPE "affiliate_withdrawal_requests_status_enum" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED')`);
        await queryRunner.query(`
            ALTER TABLE "affiliate_withdrawal_requests"
                ALTER COLUMN "status" TYPE "affiliate_withdrawal_requests_status_enum"
                USING "status"::"affiliate_withdrawal_requests_status_enum";
        `);
    }
}
