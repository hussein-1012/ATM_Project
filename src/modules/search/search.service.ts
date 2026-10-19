import { BadRequestException, Injectable } from '@nestjs/common';
import { normalizeArabic } from '../../common/utils/arabic-normalize.util';
import type { AtmBank } from '../atms/entities/atm-bank.enum';

export interface AtmSearchInput {
  q?: string;
  bank?: AtmBank;
  wheelchair?: boolean;
  maxDistance?: number;
  lat?: number;
  lng?: number;
}

export interface BuiltAtmSearch {
  /** SQL boolean expression over the alias `a` (no leading WHERE), or '' when unfiltered. */
  whereSql: string;
  /** Positional parameters matching the $n placeholders in `whereSql`/`distanceSql`. */
  values: unknown[];
  /** SQL expression yielding meters from the reference point, or null. */
  distanceSql: string | null;
}

/**
 * Owns ATM search query building: the query string is normalized with the
 * exact same Arabic normalizer used to build the stored `searchText` blob, so
 * `ILIKE` matches regardless of hamza/taa-marbuta/diacritics/case. Values are
 * always parameterized (never interpolated).
 */
@Injectable()
export class SearchService {
  normalizeQuery(q: string): string {
    return normalizeArabic(q);
  }

  /** Trigram-friendly `%normalized%` pattern with LIKE metacharacters escaped. */
  likePattern(q: string): string {
    const escaped = this.normalizeQuery(q).replace(/[\\%_]/g, (ch) => `\\${ch}`);
    return `%${escaped}%`;
  }

  build(input: AtmSearchInput): BuiltAtmSearch {
    const clauses: string[] = [];
    const values: unknown[] = [];
    let distanceSql: string | null = null;
    let pointSql: string | null = null;

    if (input.lat !== undefined && input.lng !== undefined) {
      const lngIndex = values.push(input.lng);
      const latIndex = values.push(input.lat);
      pointSql = `ST_SetSRID(ST_MakePoint($${lngIndex}, $${latIndex}), 4326)::geography`;
      distanceSql = `ST_Distance(a."location", ${pointSql})`;
    }

    if (input.q && input.q.trim()) {
      values.push(this.likePattern(input.q));
      clauses.push(`a."searchText" ILIKE $${values.length} ESCAPE '\\'`);
    }

    if (input.bank) {
      values.push(input.bank);
      clauses.push(`a."bank" = $${values.length}`);
    }

    if (input.wheelchair) {
      clauses.push(`a."wheelchairAccessible" IS TRUE`);
    }

    if (input.maxDistance !== undefined) {
      if (!pointSql) {
        throw new BadRequestException({
          message: 'maxDistance requires lat and lng',
          code: 'MAX_DISTANCE_REQUIRES_LOCATION',
        });
      }
      values.push(input.maxDistance);
      clauses.push(`ST_DWithin(a."location", ${pointSql}, $${values.length})`);
    }

    return { whereSql: clauses.join(' AND '), values, distanceSql };
  }
}
