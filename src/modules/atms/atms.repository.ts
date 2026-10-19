import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AtmBank } from './entities/atm-bank.enum';
import type { OpeningHours } from './entities/atm.entity';

export interface AtmRow {
  id: string;
  name: string;
  bank: AtmBank;
  address: string;
  isBranch: boolean;
  openingHours: OpeningHours | null;
  is24h: boolean | null;
  wheelchairAccessible: boolean | null;
  sourceFetchedAt: Date | null;
  lat: number;
  lng: number;
  distanceMeters?: number;
}

export interface NearbyParams {
  lat: number;
  lng: number;
  radius: number;
  limit: number;
}

export interface SearchRowsParams {
  whereSql: string;
  values: unknown[];
  distanceSql: string | null;
  limit: number | null;
  offset: number;
}

/**
 * Geo/read access for ATMs. `location` is a PostGIS geography, so it is never
 * hydrated as a column: coordinates are projected with ST_X/ST_Y and distance
 * is computed in SQL (GiST index for both ST_DWithin filtering and `<->` KNN
 * ordering).
 */
@Injectable()
export class AtmsRepository {
  constructor(private readonly dataSource: DataSource) {}

  private baseSelect(): string {
    return [
      'a."id"',
      'a."name"',
      'a."bank"',
      'a."address"',
      'a."isBranch"',
      'a."openingHours"',
      'a."is24h"',
      'a."wheelchairAccessible"',
      'a."sourceFetchedAt"',
      'ST_Y(a."location"::geometry) AS "lat"',
      'ST_X(a."location"::geometry) AS "lng"',
    ].join(', ');
  }

  /** ATMs within `radius` meters, nearest first (GiST `ST_DWithin` + KNN `<->`). */
  async nearby(params: NearbyParams): Promise<AtmRow[]> {
    const { lat, lng, radius, limit } = params;
    const point = `ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography`;
    return this.dataSource.query(
      `SELECT ${this.baseSelect()},
              ST_Distance(a."location", ${point}) AS "distanceMeters"
         FROM "atms" a
        WHERE ST_DWithin(a."location", ${point}, $3)
        ORDER BY a."location" <-> ${point}
        LIMIT $4`,
      [lat, lng, radius, limit],
    );
  }

  async findById(id: string, ref?: { lat: number; lng: number }): Promise<AtmRow | null> {
    const distanceSelect = ref
      ? `, ST_Distance(a."location", ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) AS "distanceMeters"`
      : '';
    const params = ref ? [id, ref.lng, ref.lat] : [id];
    const rows: AtmRow[] = await this.dataSource.query(
      `SELECT ${this.baseSelect()}${distanceSelect} FROM "atms" a WHERE a."id" = $1`,
      params,
    );
    return rows[0] ?? null;
  }

  async searchCount(whereSql: string, values: unknown[]): Promise<number> {
    const where = whereSql.trim() ? whereSql : 'TRUE';
    const rows: Array<{ count: number }> = await this.dataSource.query(
      `SELECT count(*)::int AS "count" FROM "atms" a WHERE ${where}`,
      values,
    );
    return rows[0]?.count ?? 0;
  }

  async searchRows(params: SearchRowsParams): Promise<AtmRow[]> {
    const { whereSql, values, distanceSql, limit, offset } = params;
    const where = whereSql.trim() ? whereSql : 'TRUE';
    const select = `${this.baseSelect()}${distanceSql ? `, ${distanceSql} AS "distanceMeters"` : ''}`;
    const order = distanceSql
      ? '"distanceMeters" ASC NULLS LAST, a."name" ASC'
      : 'a."name" ASC';

    const bound = [...values];
    let sql = `SELECT ${select} FROM "atms" a WHERE ${where} ORDER BY ${order}`;
    if (limit !== null) {
      bound.push(limit);
      sql += ` LIMIT $${bound.length}`;
    }
    if (offset > 0) {
      bound.push(offset);
      sql += ` OFFSET $${bound.length}`;
    }
    return this.dataSource.query(sql, bound);
  }
}
