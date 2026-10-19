import { CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('favorites')
export class Favorite {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @PrimaryColumn({ type: 'uuid' })
  atmId!: string;

  @Index('ix_favorites_atm')
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
