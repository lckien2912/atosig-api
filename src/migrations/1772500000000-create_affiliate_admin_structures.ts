import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAffiliateAdminStructures1772500000000 implements MigrationInterface {
    name = 'CreateAffiliateAdminStructures1772500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Rename affiliate_withdrawals → affiliate_commissions
        await queryRunner.query(`ALTER TABLE "affiliate_withdrawals" RENAME TO "affiliate_commissions"`);
        await queryRunner.query(`
            ALTER TABLE "affiliate_commissions"
                RENAME CONSTRAINT "FK_withdrawal_request"
                TO "FK_affiliate_commissions_withdrawal_request"
        `);

        // 2. Create affiliate_payments
        await queryRunner.query(`
            CREATE TABLE "affiliate_payments" (
                "id"             uuid          NOT NULL DEFAULT gen_random_uuid(),
                "batch_name"     varchar(255),
                "total_amount"   decimal(15,2) NOT NULL,
                "payment_date"   TIMESTAMP     NOT NULL,
                "payment_method" varchar(20)   NOT NULL,
                "transaction_id" varchar(255),
                "proof_url"      varchar(500),
                "notes"          text,
                "created_by"     varchar(36),
                "created_at"     TIMESTAMP     NOT NULL DEFAULT now(),
                CONSTRAINT "PK_affiliate_payments" PRIMARY KEY ("id")
            )
        `);

        // 3. Add columns + FK + indexes to affiliate_withdrawal_requests
        await queryRunner.query(`ALTER TABLE "affiliate_withdrawal_requests" ADD COLUMN IF NOT EXISTS "payment_id" uuid`);
        await queryRunner.query(`ALTER TABLE "affiliate_withdrawal_requests" ADD COLUMN IF NOT EXISTS "hold_until" TIMESTAMP`);
        await queryRunner.query(`
            ALTER TABLE "affiliate_withdrawal_requests"
                ADD CONSTRAINT "fk_awr_payment_id"
                FOREIGN KEY ("payment_id") REFERENCES "affiliate_payments"("id") ON DELETE SET NULL
        `);
        await queryRunner.query(`CREATE INDEX "idx_wr_status"     ON "affiliate_withdrawal_requests" ("status")`);
        await queryRunner.query(`CREATE INDEX "idx_wr_affiliate"  ON "affiliate_withdrawal_requests" ("affiliate_uid")`);
        await queryRunner.query(`CREATE INDEX "idx_wr_hold_until" ON "affiliate_withdrawal_requests" ("hold_until") WHERE hold_until IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "idx_wr_payment"    ON "affiliate_withdrawal_requests" ("payment_id")  WHERE payment_id IS NOT NULL`);

        // 4. Create commission_audit_logs
        await queryRunner.query(`
            CREATE TABLE "commission_audit_logs" (
                "id"            uuid        NOT NULL DEFAULT gen_random_uuid(),
                "request_id"    uuid,
                "affiliate_uid" character varying,
                "action"        varchar(20) NOT NULL,
                "performed_by"  varchar(36),
                "note"          text,
                "created_at"    TIMESTAMP   NOT NULL DEFAULT now(),
                CONSTRAINT "PK_commission_audit_logs" PRIMARY KEY ("id"),
                CONSTRAINT "FK_audit_request_id"
                    FOREIGN KEY ("request_id") REFERENCES "affiliate_withdrawal_requests"("id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_audit_request"   ON "commission_audit_logs" ("request_id")    WHERE request_id IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "idx_audit_affiliate" ON "commission_audit_logs" ("affiliate_uid") WHERE affiliate_uid IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "idx_audit_created"   ON "commission_audit_logs" ("created_at" DESC)`);

        // 5. Add affiliate_status + affiliate_tier to users
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "affiliate_status" varchar(20) NOT NULL DEFAULT 'ACTIVE'`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "affiliate_tier"   varchar(20) NOT NULL DEFAULT 'INDIVIDUAL'`);
        await queryRunner.query(`CREATE INDEX "idx_users_affiliate_status" ON "users" ("affiliate_status") WHERE ref_code IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 5. Revert users
        await queryRunner.query(`DROP INDEX "idx_users_affiliate_status"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "affiliate_tier"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "affiliate_status"`);

        // 4. Drop commission_audit_logs
        await queryRunner.query(`DROP INDEX "idx_audit_created"`);
        await queryRunner.query(`DROP INDEX "idx_audit_affiliate"`);
        await queryRunner.query(`DROP INDEX "idx_audit_request"`);
        await queryRunner.query(`DROP TABLE "commission_audit_logs"`);

        // 3. Revert affiliate_withdrawal_requests changes
        await queryRunner.query(`DROP INDEX "idx_wr_payment"`);
        await queryRunner.query(`DROP INDEX "idx_wr_hold_until"`);
        await queryRunner.query(`DROP INDEX "idx_wr_affiliate"`);
        await queryRunner.query(`DROP INDEX "idx_wr_status"`);
        await queryRunner.query(`ALTER TABLE "affiliate_withdrawal_requests" DROP CONSTRAINT "fk_awr_payment_id"`);
        await queryRunner.query(`ALTER TABLE "affiliate_withdrawal_requests" DROP COLUMN IF EXISTS "payment_id"`);
        await queryRunner.query(`ALTER TABLE "affiliate_withdrawal_requests" DROP COLUMN IF EXISTS "hold_until"`);

        // 2. Drop affiliate_payments
        await queryRunner.query(`DROP TABLE "affiliate_payments"`);

        // 1. Rename back affiliate_commissions → affiliate_withdrawals
        await queryRunner.query(`
            ALTER TABLE "affiliate_commissions"
                RENAME CONSTRAINT "FK_affiliate_commissions_withdrawal_request"
                TO "FK_withdrawal_request"
        `);
        await queryRunner.query(`ALTER TABLE "affiliate_commissions" RENAME TO "affiliate_withdrawals"`);
    }
}
