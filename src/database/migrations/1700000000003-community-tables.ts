import { MigrationInterface, QueryRunner } from 'typeorm';

/** Community features: reports, favorites, recent searches. */
export class CommunityTables1700000000003 implements MigrationInterface {
  name = 'CommunityTables1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "atm_report_status_enum" AS ENUM ('WORKING', 'OUT_OF_CASH', 'OUT_OF_SERVICE')`,
    );

    await queryRunner.query(`
      CREATE TABLE "atm_reports" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "atmId" uuid NOT NULL REFERENCES "atms"("id") ON DELETE CASCADE,
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "status" "atm_report_status_enum" NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_atm_reports_atm_created" ON "atm_reports" ("atmId", "createdAt" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_atm_reports_user_atm_created" ON "atm_reports" ("userId", "atmId", "createdAt" DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE "favorites" (
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "atmId" uuid NOT NULL REFERENCES "atms"("id") ON DELETE CASCADE,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("userId", "atmId")
      )
    `);
    await queryRunner.query(`CREATE INDEX "ix_favorites_atm" ON "favorites" ("atmId")`);

    await queryRunner.query(`
      CREATE TABLE "recent_searches" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "query" varchar(120) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_recent_searches_user_created" ON "recent_searches" ("userId", "createdAt" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "recent_searches"`);
    await queryRunner.query(`DROP TABLE "favorites"`);
    await queryRunner.query(`DROP TABLE "atm_reports"`);
    await queryRunner.query(`DROP TYPE "atm_report_status_enum"`);
  }
}
