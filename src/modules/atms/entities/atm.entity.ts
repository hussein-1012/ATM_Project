import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AtmBank } from './atm-bank.enum';

export type AtmDocument = HydratedDocument<Atm>;

export interface OpeningHoursInterval {
  open: string; // "HH:MM" local (Africa/Cairo)
  close: string; // "HH:MM"; close may wrap past midnight (close <= open means overnight)
}

export type OpeningHours = Partial<
  Record<
    'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
    OpeningHoursInterval[]
  >
>;

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

/**
 * ATM / bank machine. `location` is a GeoJSON Point with a 2dsphere index
 * for geo queries ($nearSphere, $geoNear).
 *
 * Not stored by design: phone, rating, reviews, photos, plus codes.
 */
@Schema({
  timestamps: true,
  collection: 'atms',
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Atm {
  id!: string;

  @Prop({ required: true, maxlength: 255 })
  name!: string;

  @Prop({ type: String, enum: Object.values(AtmBank), default: AtmBank.OTHER })
  bank!: AtmBank;

  @Prop({ default: '' })
  address!: string;

  @Prop({
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true },
  })
  location!: GeoPoint;

  @Prop({ default: false })
  isBranch!: boolean;

  @Prop({ type: Object, default: null })
  openingHours!: OpeningHours | null;

  @Prop({ type: Boolean, default: null })
  is24h!: boolean | null;

  @Prop({ type: Boolean, default: null })
  wheelchairAccessible!: boolean | null;

  @Prop({ required: true, maxlength: 64 })
  source!: string;

  @Prop({ required: true, maxlength: 255 })
  sourceId!: string;

  @Prop({ type: Date, default: null })
  sourceFetchedAt!: Date | null;

  /** Normalized name + address + bank label; used for text search. */
  @Prop({ default: '' })
  searchText!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const AtmSchema = SchemaFactory.createForClass(Atm);

// Geospatial index for nearby queries
AtmSchema.index({ location: '2dsphere' });

// Unique upsert key for the importer
AtmSchema.index({ source: 1, sourceId: 1 }, { unique: true });

// Case-insensitive text search on the searchText blob
AtmSchema.index({ searchText: 'text' });
