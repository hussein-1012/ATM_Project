import { Module } from '@nestjs/common';
import { AtmImportService } from './import.service';
import { AtmJsonMapper } from './atm-json.mapper';

/**
 * Exposes the importer pieces for DI-based use (e.g. tests, future admin
 * endpoints). The CLI path (run-import.ts) uses these classes directly with
 * its own DataSource.
 */
@Module({
  providers: [AtmJsonMapper, AtmImportService],
  exports: [AtmJsonMapper, AtmImportService],
})
export class ImporterModule {}
