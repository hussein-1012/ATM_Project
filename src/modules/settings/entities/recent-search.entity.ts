import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RecentSearchDocument = HydratedDocument<RecentSearch>;

/** Only the last 10 rows per user are kept (trimmed on insert). */
@Schema({
  timestamps: true,
  collection: 'recent_searches',
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class RecentSearch {
  id!: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, maxlength: 120 })
  query!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const RecentSearchSchema = SchemaFactory.createForClass(RecentSearch);

RecentSearchSchema.index({ userId: 1, createdAt: -1 });
