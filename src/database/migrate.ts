import 'reflect-metadata';
import { AppDataSource } from './data-source';

/**
 * Standalone migration runner (used by the docker-compose one-shot service
 * and available locally). Never enables synchronize.
 *
 *   ts-node src/database/migrate.ts            # run pending migrations
 *   ts-node src/database/migrate.ts revert     # revert the last migration
 */
async function main(): Promise<void> {
  const command = process.argv[2] ?? 'run';
  await AppDataSource.initialize();
  try {
    if (command === 'revert') {
      await AppDataSource.undoLastMigration();
      console.log('[migrate] reverted last migration');
    } else {
      const applied = await AppDataSource.runMigrations({ transaction: 'each' });
      if (applied.length === 0) {
        console.log('[migrate] no pending migrations');
      } else {
        console.log(`[migrate] applied ${applied.length}: ${applied.map((m) => m.name).join(', ')}`);
      }
    }
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
