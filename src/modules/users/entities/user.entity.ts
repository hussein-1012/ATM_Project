import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum TravelMode {
  WALK = 'walk',
  DRIVE = 'drive',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Index('ux_users_email', { unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'enum', enum: TravelMode, default: TravelMode.WALK })
  preferredTravelMode!: TravelMode;

  @Column({ type: 'boolean', default: true })
  voiceGuidance!: boolean;

  @Column({ type: 'varchar', length: 10, default: 'ar' })
  language!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
