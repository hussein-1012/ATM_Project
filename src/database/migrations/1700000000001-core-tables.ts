import { MigrationInterface, QueryRunner } from 'typeorm';

/** users + refresh_tokens */
export class CoreTables1700000000001 implements MigrationInterface {
  name = 'CoreTables1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "travel_mode_enum" AS ENUM ('walk', 'drive')`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(120) NOT NULL,
        "email" varchar(255) NOT NULL,
        "passwordHash" varchar(255) NOT NULL,
        "preferredTravelMode" "travel_mode_enum" NOT NULL DEFAULT 'walk',
        "voiceGuidance" boolean NOT NULL DEFAULT true,
        "language" varchar(10) NOT NULL DEFAULT 'ar',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "ux_users_email" ON "users" ("email")`);

    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "tokenHash" varchar(64) NOT NULL,
        "familyId" uuid NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "revokedAt" timestamptz,
        "deviceInfo" varchar(255)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_refresh_tokens_hash" ON "refresh_tokens" ("tokenHash")`,
    );
    await queryRunner.query(`CREATE INDEX "ix_refresh_tokens_user" ON "refresh_tokens" ("userId")`);
    await queryRunner.query(
      `CREATE INDEX "ix_refresh_tokens_family" ON "refresh_tokens" ("familyId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP INDEX "ux_users_email"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "travel_mode_enum"`);
  }
}
