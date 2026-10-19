import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Refresh tokens are opaque random strings; only their sha256 hash is stored.
 * `familyId` groups a rotation chain so token reuse revokes the whole family.
 */
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('ix_refresh_tokens_user')
  @Column({ type: 'uuid' })
  userId!: string;

  @Index('ux_refresh_tokens_hash', { unique: true })
  @Column({ type: 'varchar', length: 64, unique: true })
  tokenHash!: string;

  @Index('ix_refresh_tokens_family')
  @Column({ type: 'uuid' })
  familyId!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceInfo!: string | null;
}
