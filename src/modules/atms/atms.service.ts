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
    const built = this.searchQuery.build({
      q: dto.q,
      bank: dto.bank,
      wheelchair: dto.wheelchair,
      maxDistance: dto.maxDistance,
      lat: dto.lat,
      lng: dto.lng,
    });

    if (dto.openNow) {
      // Exclude unknown hours at the SQL level, then apply the exact
      // open/closed evaluation (Cairo time + wrap intervals) in-process.
      const clauses = [built.whereSql, '(a."is24h" IS TRUE OR a."openingHours" IS NOT NULL)'].filter(
        (clause) => clause.trim().length > 0,
      );
      const candidates = await this.repo.searchRows({
        whereSql: clauses.join(' AND '),
        values: built.values,
        distanceSql: built.distanceSql,
        limit: null,
        offset: 0,
      });
      const open = candidates.filter((row) => this.openNow.status(row, now) === 'OPEN');
      const start = (dto.page - 1) * dto.limit;
      return {
        items: open.slice(start, start + dto.limit).map((row) => this.toDto(row, now)),
        meta: { page: dto.page, limit: dto.limit, total: open.length },
      };
    }

    const [total, rows] = await Promise.all([
      this.repo.searchCount(built.whereSql, built.values),
      this.repo.searchRows({
        whereSql: built.whereSql,
        values: built.values,
        distanceSql: built.distanceSql,
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
