import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DRIVE_METERS_PER_MINUTE,
  WALK_METERS_PER_MINUTE,
} from '../../common/constants';
import { SearchService } from '../search/search.service';
import { AtmsRepository, type AtmRow } from './atms.repository';
import type {
  AtmResponseDto,
  AtmDetailResponseDto,
  NearbyResponseDto,
  SearchResponseDto,
} from './dto/atm-response.dto';
import type { NearbyQueryDto, SearchQueryDto } from './dto/atm-query.dto';
import { OpenNowService } from './open-now.service';
import { ReportSummaryService } from './report-summary.service';

@Injectable()
export class AtmsService {
  constructor(
    private readonly repo: AtmsRepository,
    private readonly searchQuery: SearchService,
    private readonly openNow: OpenNowService,
    private readonly reportSummary: ReportSummaryService,
  ) {}

  async nearby(dto: NearbyQueryDto): Promise<NearbyResponseDto> {
    const now = new Date();
    const rows = await this.repo.nearby({
      lat: dto.lat,
      lng: dto.lng,
      radius: dto.radius,
      limit: dto.limit,
    });

    return {
      items: rows.map((row) => this.toDto(row, now)),
      meta: {
        lat: dto.lat,
        lng: dto.lng,
        radius: dto.radius,
        limit: dto.limit,
        count: rows.length,
      },
    };
  }

  async search(dto: SearchQueryDto): Promise<SearchResponseDto> {
    const now = new Date();
    const filters = this.searchQuery.build({
      q: dto.q,
      bank: dto.bank,
      wheelchair: dto.wheelchair,
      maxDistance: dto.maxDistance,
      lat: dto.lat,
      lng: dto.lng,
    });

    if (dto.openNow) {
      // Fetch all candidates with opening hours, then apply the exact
      // open/closed evaluation (Cairo time + wrap intervals) in-process.
      const openFilters = { ...filters };
      const candidates = await this.repo.searchRows({
        filters: openFilters,
        limit: 10000, // fetch all for client-side open/closed filtering
        offset: 0,
      });
      const withHours = candidates.filter(
        (row) => row.is24h === true || row.openingHours !== null,
      );
      const open = withHours.filter((row) => this.openNow.status(row, now) === 'OPEN');
      const start = (dto.page - 1) * dto.limit;
      return {
        items: open.slice(start, start + dto.limit).map((row) => this.toDto(row, now)),
        meta: { page: dto.page, limit: dto.limit, total: open.length },
      };
    }

    const [total, rows] = await Promise.all([
      this.repo.searchCount(filters),
      this.repo.searchRows({
        filters,
        limit: dto.limit,
        offset: (dto.page - 1) * dto.limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.toDto(row, now)),
      meta: { page: dto.page, limit: dto.limit, total },
    };
  }

  async detail(id: string, ref?: { lat: number; lng: number }): Promise<AtmDetailResponseDto> {
    const now = new Date();
    const row = await this.repo.findById(id, ref);
    if (!row) {
      throw new NotFoundException({ message: 'ATM not found', code: 'ATM_NOT_FOUND' });
    }
    const reportSummary = await this.reportSummary.forAtm(id, now);
    return { ...this.toDto(row, now), reportSummary };
  }

  exists(id: string): Promise<boolean> {
    return this.repo.exists(id);
  }

  /** Hydrate a set of ATMs (favorites), preserving nothing about input order. */
  async findManyByIds(ids: string[], ref?: { lat: number; lng: number }): Promise<AtmResponseDto[]> {
    const rows = await this.repo.findManyByIds(ids, ref);
    const now = new Date();
    return rows.map((row) => this.toDto(row, now));
  }

  private toDto(row: AtmRow, now: Date): AtmResponseDto {
    const dto: AtmResponseDto = {
      id: row.id,
      name: row.name,
      bank: row.bank,
      address: row.address,
      location: { lat: row.lat, lng: row.lng },
      isBranch: row.isBranch,
      openingHours: row.openingHours,
      is24h: row.is24h,
      wheelchairAccessible: row.wheelchairAccessible,
      sourceFetchedAt: row.sourceFetchedAt ? new Date(row.sourceFetchedAt).toISOString() : null,
      openNow: this.openNow.status(row, now),
      travelTimesAreEstimates: true,
    };

    if (row.distanceMeters !== undefined && row.distanceMeters !== null) {
      const distance = Math.round(row.distanceMeters);
      dto.distanceMeters = distance;
      dto.walkMinutes = Math.ceil(distance / WALK_METERS_PER_MINUTE);
      dto.driveMinutes = Math.ceil(distance / DRIVE_METERS_PER_MINUTE);
    }

    return dto;
  }
}
