import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum AtmReportStatus {
  WORKING = 'WORKING',
  OUT_OF_CASH = 'OUT_OF_CASH',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
}

/** Crowd-sourced, never bank-confirmed. */
@Entity('atm_reports')
@Index('ix_atm_reports_atm_created', ['atmId', 'createdAt'])
@Index('ix_atm_reports_user_atm_created', ['userId', 'atmId', 'createdAt'])
export class AtmReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  atmId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: AtmReportStatus })
  status!: AtmReportStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
