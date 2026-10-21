import { BadRequestException, Injectable } from '@nestjs/common';
import { normalizeArabic } from '../../common/utils/arabic-normalize.util';
import type { AtmBank } from '../atms/entities/atm-bank.enum';
import type { SearchFilters } from '../atms/atms.repository';

export interface AtmSearchInput {
  q?: string;
  bank?: AtmBank;
  wheelchair?: boolean;
  maxDistance?: number;
  lat?: number;
  lng?: number;
}

/**
 * Owns ATM search query building: the query string is normalized with the
 * exact same Arabic normalizer used to build the stored `searchText` blob.
 */
@Injectable()
export class SearchService {
  normalizeQuery(q: string): string {
    return normalizeArabic(q);
  }

  build(input: AtmSearchInput): SearchFilters {
    if (input.maxDistance !== undefined && (input.lat === undefined || input.lng === undefined)) {
      throw new BadRequestException({
        message: 'maxDistance requires lat and lng',
        code: 'MAX_DISTANCE_REQUIRES_LOCATION',
      });
    }

    return {
      q: input.q,
      bank: input.bank,
      wheelchair: input.wheelchair,
      maxDistance: input.maxDistance,
      lat: input.lat,
      lng: input.lng,
    };
  }
}
