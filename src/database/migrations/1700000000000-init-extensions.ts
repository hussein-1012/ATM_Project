import { MigrationInterface, QueryRunner } from 'typeorm';

/** Enables PostGIS and pg_trgm. Requires a role allowed to CREATE EXTENSION. */
export class InitExtensions1700000000000 implements MigrationInterface {
  name = 'InitExtensions1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  }

  public async down(): Promise<void> {
    // Extensions are shared infrastructure — intentionally not dropped.
  }
}
