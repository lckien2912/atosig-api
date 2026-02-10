import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRefFieldsToUser1770540106727 implements MigrationInterface {
    name = 'AddRefFieldsToUser1770540106727'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "ref_code" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_e239429bd6bf94aeccdf50a3fe8" UNIQUE ("ref_code")`);
        await queryRunner.query(`ALTER TABLE "users" ADD "ref_from" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "ref_from"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_e239429bd6bf94aeccdf50a3fe8"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "ref_code"`);
    }
}
