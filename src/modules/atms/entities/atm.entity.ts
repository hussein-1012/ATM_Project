import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AtmBank } from './atm-bank.enum';

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
 * ATM / bank machine. `location` is a PostGIS geography(Point, 4326) and is
 * never hydrated directly (select: false) — geo reads go through explicit
 * ST_X/ST_Y projections in AtmsRepository.
 *
 * Not stored by design: phone, rating, reviews, photos, plus codes.
 */
@Entity('atms')
@Index('ux_atms_source_source_id', ['source', 'sourceId'], { unique: true })
export class Atm {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'enum', enum: AtmBank, default: AtmBank.OTHER })
  bank!: AtmBank;

  @Column({ type: 'text', default: '' })
  address!: string;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    select: false,
  })
  location!: GeoPoint;

  @Column({ type: 'boolean', default: false })
  isBranch!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  openingHours!: OpeningHours | null;

  @Column({ type: 'boolean', nullable: true })
  is24h!: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  wheelchairAccessible!: boolean | null;

  @Column({ type: 'varchar', length: 64 })
  source!: string;

  @Column({ type: 'varchar', length: 255 })
  sourceId!: string;

  @Column({ type: 'timestamptz', nullable: true })
  sourceFetchedAt!: Date | null;

  /** Normalized name + address + bank label; trigram-indexed search target. */
  @Column({ type: 'text', default: '' })
  searchText!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
