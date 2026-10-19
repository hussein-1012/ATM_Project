import { MigrationInterface, QueryRunner } from 'typeorm';

/** ATMs with PostGIS geography location, GiST index and trigram search index. */
export class Atms1700000000002 implements MigrationInterface {
  name = 'Atms1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "atm_bank_enum" AS ENUM (
        'NBE', 'BANQUE_MISR', 'BANQUE_DU_CAIRE', 'QNB', 'CIB', 'ALEXANDRIA_BANK',
        'AGRICULTURAL_BANK', 'EGBANK', 'HOUSING_DEVELOPMENT', 'FAISAL_ISLAMIC',
        'AL_BARAKA', 'AAIB', 'BANK_NXT', 'ADCB', 'CREDIT_AGRICOLE', 'POSTAL', 'OTHER'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "atms" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "bank" "atm_bank_enum" NOT NULL DEFAULT 'OTHER',
        "address" text NOT NULL DEFAULT '',
        "location" geography(Point, 4326) NOT NULL,
        "isBranch" boolean NOT NULL DEFAULT false,
        "openingHours" jsonb,
        "is24h" boolean,
        "wheelchairAccessible" boolean,
        "source" varchar(64) NOT NULL,
        "sourceId" varchar(255) NOT NULL,
        "sourceFetchedAt" timestamptz,
        "searchText" text NOT NULL DEFAULT '',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Upsert target for the importer.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_atms_source_source_id" ON "atms" ("source", "sourceId")`,
    );
    // GiST index used by ST_DWithin + KNN (<->) ordering.
    await queryRunner.query(
      `CREATE INDEX "atm_location_geog_gix" ON "atms" USING GIST ("location")`,
    );
    // Trigram index for ILIKE '%q%' on the normalized search blob.
    await queryRunner.query(
      `CREATE INDEX "atm_search_trgm_idx" ON "atms" USING GIN ("searchText" gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "atms"`);
    await queryRunner.query(`DROP TYPE "atm_bank_enum"`);
  }
}
