import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAffiliateTables1772400000000 implements MigrationInterface {
    name = 'CreateAffiliateTables1772400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create enums
        await queryRunner.query(`CREATE TYPE "affiliate_withdrawals_status_enum" AS ENUM('PENDING', 'AVAILABLE', 'WITHDRAWN')`);
        await queryRunner.query(`CREATE TYPE "affiliate_withdrawal_requests_status_enum" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED')`);

        // 2. Create affiliate_withdrawal_requests table (must exist before FK)
        await queryRunner.query(`
            CREATE TABLE "affiliate_withdrawal_requests" (
                "id"            uuid NOT NULL DEFAULT uuid_generate_v4(),
                "affiliate_uid" character varying NOT NULL,
                "total_amount"  numeric(15,2) NOT NULL,
                "status"        "affiliate_withdrawal_requests_status_enum" NOT NULL DEFAULT 'PENDING',
                "user_note"     character varying,
                "admin_note"    character varying,
                "processed_by"  uuid,
                "processed_at"  TIMESTAMP,
                "created_at"    TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at"    TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_affiliate_withdrawal_requests" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_withdrawal_request_affiliate_status"
            ON "affiliate_withdrawal_requests" ("affiliate_uid", "status")
        `);

        // 3. Create affiliate_withdrawals table
        await queryRunner.query(`
            CREATE TABLE "affiliate_withdrawals" (
                "id"                    uuid NOT NULL DEFAULT uuid_generate_v4(),
                "affiliate_uid"         character varying NOT NULL,
                "amount"                numeric(15,2) NOT NULL,
                "status"                "affiliate_withdrawals_status_enum" NOT NULL DEFAULT 'AVAILABLE',
                "source_order_id"       character varying,
                "level"                 smallint,
                "withdrawal_request_id" uuid,
                "created_at"            TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at"            TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_affiliate_withdrawals" PRIMARY KEY ("id"),
                CONSTRAINT "FK_withdrawal_request"
                    FOREIGN KEY ("withdrawal_request_id")
                    REFERENCES "affiliate_withdrawal_requests"("id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_affiliate_withdrawals_order_uid"
            ON "affiliate_withdrawals" ("source_order_id", "affiliate_uid")
            WHERE "source_order_id" IS NOT NULL
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_affiliate_withdrawals_uid_status"
            ON "affiliate_withdrawals" ("affiliate_uid", "status")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_withdrawal_request_id"
            ON "affiliate_withdrawals" ("withdrawal_request_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_withdrawal_request_id"`);
        await queryRunner.query(`DROP INDEX "IDX_affiliate_withdrawals_uid_status"`);
        await queryRunner.query(`DROP INDEX "IDX_affiliate_withdrawals_order_uid"`);
        await queryRunner.query(`DROP TABLE "affiliate_withdrawals"`);
        await queryRunner.query(`DROP INDEX "IDX_withdrawal_request_affiliate_status"`);
        await queryRunner.query(`DROP TABLE "affiliate_withdrawal_requests"`);
        await queryRunner.query(`DROP TYPE "affiliate_withdrawal_requests_status_enum"`);
        await queryRunner.query(`DROP TYPE "affiliate_withdrawals_status_enum"`);
    }
}
