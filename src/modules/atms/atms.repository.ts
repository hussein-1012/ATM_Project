import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { AtmBank } from './entities/atm-bank.enum';
import { Atm, type AtmDocument, type OpeningHours } from './entities/atm.entity';

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

export interface SearchFilters {
  q?: string;
  bank?: AtmBank;
  wheelchair?: boolean;
  maxDistance?: number;
  lat?: number;
  lng?: number;
}

export interface SearchRowsParams {
  filters: SearchFilters;
  limit: number;
  offset: number;
}

/**
 * Geo/read access for ATMs. Uses MongoDB 2dsphere index for spatial queries
 * ($geoNear aggregation for distance calculation, $nearSphere for filtering).
 */
@Injectable()
export class AtmsRepository {
  constructor(
    @InjectModel(Atm.name) private readonly atmModel: Model<Atm>,
  ) {}

  private toRow(doc: AtmDocument, distanceMeters?: number): AtmRow {
    return {
      id: doc.id,
      name: doc.name,
      bank: doc.bank,
      address: doc.address,
      isBranch: doc.isBranch,
      openingHours: doc.openingHours,
      is24h: doc.is24h,
      wheelchairAccessible: doc.wheelchairAccessible,
      sourceFetchedAt: doc.sourceFetchedAt,
      lat: doc.location.coordinates[1],
      lng: doc.location.coordinates[0],
      ...(distanceMeters !== undefined ? { distanceMeters } : {}),
    };
  }

  /** ATMs within `radius` meters, nearest first (2dsphere + $geoNear). */
  async nearby(params: NearbyParams): Promise<AtmRow[]> {
    const { lat, lng, radius, limit } = params;
    const results = await this.atmModel.aggregate<AtmDocument & { distanceMeters: number }>([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distanceMeters',
          maxDistance: radius,
          spherical: true,
        },
      },
      { $limit: limit },
    ]);
    return results.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name,
      bank: doc.bank,
      address: doc.address,
      isBranch: doc.isBranch,
      openingHours: doc.openingHours,
      is24h: doc.is24h,
      wheelchairAccessible: doc.wheelchairAccessible,
      sourceFetchedAt: doc.sourceFetchedAt,
      lat: doc.location.coordinates[1],
      lng: doc.location.coordinates[0],
      distanceMeters: doc.distanceMeters,
    }));
  }

  async findById(id: string, ref?: { lat: number; lng: number }): Promise<AtmRow | null> {
    if (ref) {
      const results = await this.atmModel.aggregate<AtmDocument & { distanceMeters: number }>([
        { $match: { _id: this.objectId(id) } },
        {
          $addFields: {
            distanceMeters: {
              $let: {
                vars: {
                  refPoint: { type: 'Point', coordinates: [ref.lng, ref.lat] },
                },
                in: {
                  $function: {
                    body: 'function() { return null; }',
                    args: [],
                    lang: 'js',
                  },
                },
              },
            },
          },
        },
      ]);
      // Fallback: lookup without aggregation distance, compute with geoNear if needed
      const doc = await this.atmModel.findById(id).exec();
      if (!doc) return null;

      // Use a separate geoNear query for distance
      const distResults = await this.atmModel.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [ref.lng, ref.lat] },
            distanceField: 'distanceMeters',
            spherical: true,
            query: { _id: this.objectId(id) },
          },
        },
      ]);
      const distanceMeters = distResults[0]?.distanceMeters;
      return this.toRow(doc, distanceMeters);
    }

    const doc = await this.atmModel.findById(id).exec();
    return doc ? this.toRow(doc) : null;
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.atmModel.countDocuments({ _id: id }).exec();
    return count > 0;
  }

  /** Load a set of ATMs by id (favorites), optionally with distance from a reference point. */
  async findManyByIds(ids: string[], ref?: { lat: number; lng: number }): Promise<AtmRow[]> {
    if (ids.length === 0) return [];
    const objectIds = ids.map((id) => this.objectId(id));

    if (ref) {
      const results = await this.atmModel.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [ref.lng, ref.lat] },
            distanceField: 'distanceMeters',
            spherical: true,
            query: { _id: { $in: objectIds } },
          },
        },
      ]);
      return results.map((doc: any) => ({
        id: doc._id.toString(),
        name: doc.name,
        bank: doc.bank,
        address: doc.address,
        isBranch: doc.isBranch,
        openingHours: doc.openingHours,
        is24h: doc.is24h,
        wheelchairAccessible: doc.wheelchairAccessible,
        sourceFetchedAt: doc.sourceFetchedAt,
        lat: doc.location.coordinates[1],
        lng: doc.location.coordinates[0],
        distanceMeters: doc.distanceMeters,
      }));
    }

    const docs = await this.atmModel.find({ _id: { $in: objectIds } }).exec();
    return docs.map((doc) => this.toRow(doc));
  }

  async searchCount(filters: SearchFilters): Promise<number> {
    const query = this.buildSearchQuery(filters);
    return this.atmModel.countDocuments(query).exec();
  }

  async searchRows(params: SearchRowsParams): Promise<AtmRow[]> {
    const { filters, limit, offset } = params;

    // If we have lat/lng, use $geoNear for distance + sorting
    if (filters.lat !== undefined && filters.lng !== undefined) {
      const matchFilter: Record<string, unknown> = {};
      if (filters.q?.trim()) {
        matchFilter.searchText = { $regex: this.escapeRegex(filters.q), $options: 'i' };
      }
      if (filters.bank) matchFilter.bank = filters.bank;
      if (filters.wheelchair) matchFilter.wheelchairAccessible = true;

      const pipeline: any[] = [
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [filters.lng, filters.lat] },
            distanceField: 'distanceMeters',
            spherical: true,
            query: matchFilter,
            ...(filters.maxDistance ? { maxDistance: filters.maxDistance } : {}),
          },
        },
      ];

      if (offset > 0) pipeline.push({ $skip: offset });
      pipeline.push({ $limit: limit });

      const results = await this.atmModel.aggregate(pipeline);
      return results.map((doc: any) => ({
        id: doc._id.toString(),
        name: doc.name,
        bank: doc.bank,
        address: doc.address,
        isBranch: doc.isBranch,
        openingHours: doc.openingHours,
        is24h: doc.is24h,
        wheelchairAccessible: doc.wheelchairAccessible,
        sourceFetchedAt: doc.sourceFetchedAt,
        lat: doc.location.coordinates[1],
        lng: doc.location.coordinates[0],
        distanceMeters: doc.distanceMeters,
      }));
    }

    // No location: simple find with name sort
    const query = this.buildSearchQuery(filters);
    const docs = await this.atmModel
      .find(query)
      .sort({ name: 1 })
      .skip(offset)
      .limit(limit)
      .exec();
    return docs.map((doc) => this.toRow(doc));
  }

  private buildSearchQuery(filters: SearchFilters): Record<string, unknown> {
    const query: Record<string, unknown> = {};
    if (filters.q?.trim()) {
      query.searchText = { $regex: this.escapeRegex(filters.q), $options: 'i' };
    }
    if (filters.bank) query.bank = filters.bank;
    if (filters.wheelchair) query.wheelchairAccessible = true;
    return query;
  }

  private escapeRegex(q: string): string {
    // Import the normalizer lazily to avoid circular deps
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { normalizeArabic } = require('../../common/utils/arabic-normalize.util');
    const normalized: string = normalizeArabic(q);
    return normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private objectId(id: string) {
    const { Types } = require('mongoose');
    return new Types.ObjectId(id);
  }
}
