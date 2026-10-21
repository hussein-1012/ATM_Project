import { readFile, stat } from 'node:fs/promises';
import mongoose, { type Connection } from 'mongoose';
import { haversineMeters } from '../../common/utils/geo.util';
import { AtmJsonMapper, type MapResult, type SkipReason } from './atm-json.mapper';
import { extractRecords, rawFileSchema } from './atm-json.schema';

const NEAR_DUPLICATE_METERS = 15;

export interface ImportSummary {
  file: string;
  source: string;
  dryRun: boolean;
  sourceFetchedAt: string;
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  skippedByReason: Partial<Record<SkipReason, number>>;
  skipSamples: Array<{ title: string; reason: SkipReason; detail?: string }>;
  duplicates: Array<{
    bank: string;
    distanceMeters: number;
    a: { name: string; lat: number; lng: number };
    b: { name: string; lat: number; lng: number };
  }>;
}

export interface ImportOptions {
  source?: string;
  dryRun?: boolean;
}

/**
 * Idempotent importer: upserts on (source, sourceId), never deletes, and
 * reports invalid records and near-duplicates instead of failing.
 */
export class AtmImportService {
  constructor(private readonly connection: Connection | null = null) {}

  async importFile(filePath: string, options: ImportOptions = {}): Promise<ImportSummary> {
    const source = options.source ?? 'google_places';
    const dryRun = options.dryRun ?? false;

    const rawText = await readFile(filePath, 'utf8');
    const parsedFile = rawFileSchema.parse(JSON.parse(rawText));
    const { records, fetchedAt } = extractRecords(parsedFile);

    let sourceFetchedAt: Date;
    if (fetchedAt) {
      sourceFetchedAt = new Date(fetchedAt);
    } else {
      const stats = await stat(filePath);
      sourceFetchedAt = stats.mtime;
    }

    const mapper = new AtmJsonMapper(source);
    const summary: ImportSummary = {
      file: filePath,
      source,
      dryRun,
      sourceFetchedAt: sourceFetchedAt.toISOString(),
      total: records.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      skippedByReason: {},
      skipSamples: [],
      duplicates: [],
    };

    const valid: Array<Extract<MapResult, { ok: true }>['value']> = [];
    for (const raw of records) {
      const result = mapper.map(raw);
      if (result.ok) {
        valid.push(result.value);
      } else {
        summary.skipped += 1;
        summary.skippedByReason[result.reason] = (summary.skippedByReason[result.reason] ?? 0) + 1;
        if (summary.skipSamples.length < 20) {
          const title =
            typeof (raw as { title?: unknown })?.title === 'string'
              ? ((raw as { title: string }).title as string)
              : '(untitled)';
          summary.skipSamples.push({ title, reason: result.reason, detail: result.detail });
        }
      }
    }

    summary.duplicates = this.findNearDuplicates(valid);

    if (dryRun) return summary;

    if (!this.connection) {
      throw new Error('A Mongoose connection is required to write the import (dryRun was false)');
    }

    const fetchedAtValue = sourceFetchedAt.toISOString();
    for (const atm of valid) {
      atm.sourceFetchedAt = new Date(fetchedAtValue);
    }

    const collection = this.connection.collection('atms');
    const bulkOps = valid.map((atm) => ({
      updateOne: {
        filter: { source: atm.source, sourceId: atm.sourceId },
        update: {
          $set: {
            name: atm.name,
            bank: atm.bank,
            address: atm.address,
            location: { type: 'Point', coordinates: [atm.lng, atm.lat] },
            isBranch: atm.isBranch,
            openingHours: atm.openingHours ?? null,
            is24h: atm.is24h,
            wheelchairAccessible: atm.wheelchairAccessible,
            sourceFetchedAt: atm.sourceFetchedAt,
            searchText: atm.searchText,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const BATCH_SIZE = 500;
    for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
      const batch = bulkOps.slice(i, i + BATCH_SIZE);
      const result = await collection.bulkWrite(batch);
      summary.inserted += result.upsertedCount;
      summary.updated += result.modifiedCount;
    }

    return summary;
  }

  /** Reports (does not delete) same-bank ATMs within ~15 m of each other. */
  private findNearDuplicates(
    atms: Array<{ name: string; bank: string; lat: number; lng: number }>,
  ): ImportSummary['duplicates'] {
    const duplicates: ImportSummary['duplicates'] = [];
    for (let i = 0; i < atms.length; i++) {
      for (let j = i + 1; j < atms.length; j++) {
        const a = atms[i];
        const b = atms[j];
        if (a.bank !== b.bank) continue;
        const distance = haversineMeters({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
        if (distance <= NEAR_DUPLICATE_METERS) {
          duplicates.push({
            bank: a.bank,
            distanceMeters: Math.round(distance * 10) / 10,
            a: { name: a.name, lat: a.lat, lng: a.lng },
            b: { name: b.name, lat: b.lat, lng: b.lng },
          });
        }
      }
    }
    return duplicates;
  }
}
