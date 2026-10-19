import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Only the last 10 rows per user are kept (trimmed on insert). */
@Entity('recent_searches')
@Index('ix_recent_searches_user_created', ['userId', 'createdAt'])
export class RecentSearch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 120 })
  query!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
