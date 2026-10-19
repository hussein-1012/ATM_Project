import 'reflect-metadata';
import { resolve } from 'node:path';
import { AppDataSource } from '../../database/data-source';
import { AtmImportService, type ImportSummary } from './import.service';

/**
 * Standalone importer entry point (no Nest DI needed):
 *
 *   pnpm import:atms [--file data/atms.json] [--dry-run] [--source google_places]
 *
 * Exit code is non-zero only for fatal errors (missing file, DB down).
 * Invalid records are skipped and reported, never fatal.
 */
function parseArgs(argv: string[]): { file?: string; dryRun: boolean; source?: string } {
  const out: { file?: string; dryRun: boolean; source?: string } = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--file') out.file = argv[++i];
    else if (arg.startsWith('--file=')) out.file = arg.slice('--file='.length);
    else if (arg === '--source') out.source = argv[++i];
    else if (arg.startsWith('--source=')) out.source = arg.slice('--source='.length);
  }
  return out;
}

function printSummary(summary: ImportSummary): void {
  const lines: string[] = [];
  lines.push('');
  lines.push(`── ATM import ${summary.dryRun ? '(DRY RUN)' : ''} ─────────────────────────`);
  lines.push(`file             : ${summary.file}`);
  lines.push(`source           : ${summary.source}`);
  lines.push(`sourceFetchedAt  : ${summary.sourceFetchedAt}`);
  lines.push(`total records    : ${summary.total}`);
  lines.push(`inserted         : ${summary.dryRun ? '-' : summary.inserted}`);
  lines.push(`updated          : ${summary.dryRun ? '-' : summary.updated}`);
  lines.push(`skipped          : ${summary.skipped}`);
  for (const [reason, count] of Object.entries(summary.skippedByReason)) {
    lines.push(`  - ${reason}: ${count}`);
  }
  if (summary.skipSamples.length) {
    lines.push('skip samples:');
    for (const s of summary.skipSamples) {
      lines.push(`  - [${s.reason}] ${s.title}${s.detail ? ` (${s.detail})` : ''}`);
    }
  }
  lines.push(`near-duplicates  : ${summary.duplicates.length}`);
  for (const d of summary.duplicates.slice(0, 30)) {
    lines.push(
      `  - ${d.bank} ${d.distanceMeters}m: "${d.a.name}" <-> "${d.b.name}"`,
    );
  }
  lines.push('───────────────────────────────────────────────────────');
  console.log(lines.join('\n'));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const file = resolve(args.file ?? process.env.IMPORT_DEFAULT_FILE ?? 'data/atms.json');

  if (args.dryRun) {
    // Validation + duplicate report only — no database required.
    const service = new AtmImportService(null);
    printSummary(await service.importFile(file, { dryRun: true, source: args.source }));
    return;
  }

  await AppDataSource.initialize();
  try {
    const service = new AtmImportService(AppDataSource);
    const summary = await service.importFile(file, {
      dryRun: false,
      source: args.source,
    });
    printSummary(summary);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error('[import] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
